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
      console.log(`✅ Dev session restored: ${this.sessionId}`)
      return
    }

    // Crear nueva sesión
    this.initPromise = this.createSession(accessToken)
    await this.initPromise
    this.initPromise = null
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

      console.log(`✅ Dev session created: ${this.sessionId}`)
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
      await fetch(`${this.backendUrl}/dev-logs/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-Session-Id': this.sessionId!
        },
        body: JSON.stringify({
          level,
          message,
          trace_id: metadata.trace_id || null,
          metadata
        })
      })
    } catch (error) {
      // Silently fail - no bloqueamos la app por logging
      console.error('Dev log send failed:', error)
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
