/**
 * Dev Logger Client - Envía logs del frontend al sistema dev-logs
 *
 * Solo funciona en staging (NEXT_PUBLIC_ENVIRONMENT=staging)
 * Logs se envían a backend-dev → Redis → Admin panel WebSocket
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface DevSession {
  session_id: string
  user_email: string
  expires_at: string
}

class DevLogger {
  private sessionId: string | null = null
  private backendUrl: string
  private isStaging: boolean
  private initPromise: Promise<void> | null = null
  private consoleIntercepted: boolean = false
  private originalConsole: {
    log: typeof console.log
    info: typeof console.info
    warn: typeof console.warn
    error: typeof console.error
  } | null = null

  constructor() {
    this.backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://autokufe-backend-dev.fly.dev'
    this.isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging'
  }

  /**
   * Inicializa dev session
   * Debe llamarse al iniciar la app (solo si está en staging)
   */
  async init(accessToken: string): Promise<void> {
    // Solo en staging
    if (!this.isStaging) {
      return
    }

    // Si ya se está inicializando, esperar
    if (this.initPromise) {
      return this.initPromise
    }

    // Verificar si hay sesión guardada en localStorage
    const savedSession = this.loadSessionFromStorage()
    if (savedSession && this.isSessionValid(savedSession)) {
      this.sessionId = savedSession.session_id

      // Configure apiClient to send session_id in all requests
      if (typeof window !== 'undefined') {
        const { apiClient } = await import('@/lib/api/client')
        apiClient.setDevSessionId(this.sessionId)
      }

      console.log(`✅ Dev session restored: ${this.sessionId}`)
      this.interceptConsole()
      return
    }

    // Crear nueva sesión
    this.initPromise = this.createSession(accessToken)
    await this.initPromise
    this.initPromise = null
  }

  /**
   * Intercepta console.log/info/warn/error y los envía al dev-logs system
   */
  private interceptConsole(): void {
    if (this.consoleIntercepted || typeof window === 'undefined' || !this.isStaging) {
      return
    }

    this.consoleIntercepted = true

    // Guardar referencias originales
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    }

    // Interceptar console.log
    console.log = (...args: any[]) => {
      this.originalConsole!.log(...args)
      this.log('debug', this.formatConsoleArgs(args), this.getContext())
    }

    // Interceptar console.info
    console.info = (...args: any[]) => {
      this.originalConsole!.info(...args)
      this.log('info', this.formatConsoleArgs(args), this.getContext())
    }

    // Interceptar console.warn
    console.warn = (...args: any[]) => {
      this.originalConsole!.warn(...args)
      this.log('warn', this.formatConsoleArgs(args), this.getContext())
    }

    // Interceptar console.error
    console.error = (...args: any[]) => {
      this.originalConsole!.error(...args)
      this.log('error', this.formatConsoleArgs(args), this.getContext())
    }

    console.log('📡 Console intercepted - All logs will be sent to dev-logs system')
  }

  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    }).join(' ')
  }

  private getContext(): Record<string, any> {
    if (typeof window === 'undefined') return {}

    return {
      page: window.location.pathname,
      url: window.location.href
    }
  }

  private async createSession(accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.backendUrl}/dev-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('Failed to create dev session:', response.statusText)
        return
      }

      const session: DevSession = await response.json()
      this.sessionId = session.session_id
      this.saveSessionToStorage(session)

      // Configure apiClient to send session_id in all requests
      if (typeof window !== 'undefined') {
        const { apiClient } = await import('@/lib/api/client')
        apiClient.setDevSessionId(this.sessionId)
      }

      console.log(`✅ Dev session created: ${this.sessionId}`)
      this.interceptConsole()
    } catch (error) {
      console.error('Error creating dev session:', error)
    }
  }

  private saveSessionToStorage(session: DevSession): void {
    try {
      localStorage.setItem('dev_session', JSON.stringify(session))
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  private loadSessionFromStorage(): DevSession | null {
    try {
      const saved = localStorage.getItem('dev_session')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      // Ignore parse errors
    }
    return null
  }

  private isSessionValid(session: DevSession): boolean {
    try {
      const expiresAt = new Date(session.expires_at)
      return expiresAt > new Date()
    } catch {
      return false
    }
  }

  /**
   * Envía log al backend
   */
  log(level: LogLevel, message: string, metadata: Record<string, any> = {}): void {
    // Solo en staging
    if (!this.isStaging) {
      return
    }

    // Si no hay sesión, solo console.log
    if (!this.sessionId) {
      console.log(`[DEV] ${level.toUpperCase()}: ${message}`, metadata)
      return
    }

    // Enviar al backend de forma async (no bloquea UI)
    this.sendLog(level, message, metadata).catch(error => {
      console.error('Failed to send dev log:', error)
    })
  }

  private async sendLog(
    level: LogLevel,
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Add page to message if available
      let fullMessage = message
      if (metadata.page) {
        fullMessage = `[${metadata.page}] ${message}`
      }

      await fetch(`${this.backendUrl}/dev-logs/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-Session-Id': this.sessionId!
        },
        body: JSON.stringify({
          level,
          message: fullMessage,
          trace_id: metadata.trace_id || null,
          metadata
        })
      })
    } catch (error) {
      // Silently fail - no bloqueamos la app por logging
      // Don't use console.error here to avoid infinite loop
    }
  }

  // Shortcuts para niveles comunes
  info(message: string, metadata: Record<string, any> = {}): void {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata: Record<string, any> = {}): void {
    this.log('warn', message, metadata)
  }

  error(message: string, metadata: Record<string, any> = {}): void {
    this.log('error', message, metadata)
  }

  debug(message: string, metadata: Record<string, any> = {}): void {
    this.log('debug', message, metadata)
  }

  /**
   * Cierra sesión de dev logs (limpia localStorage)
   */
  clearSession(): void {
    this.sessionId = null
    try {
      localStorage.removeItem('dev_session')

      // Clear from apiClient too
      if (typeof window !== 'undefined') {
        import('@/lib/api/client').then(({ apiClient }) => {
          apiClient.setDevSessionId(null)
        })
      }
    } catch {
      // Ignore
    }
  }
}

// Export singleton instance
export const devLogger = new DevLogger()

// Función helper para inicializar en _app.tsx o layout
export async function initDevLogger(accessToken: string): Promise<void> {
  await devLogger.init(accessToken)
}
