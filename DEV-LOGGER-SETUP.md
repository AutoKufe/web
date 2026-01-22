# Dev Logger Setup - Logs centralizados en Admin Panel

Este sistema envía logs del frontend directamente al admin panel en tiempo real durante desarrollo local.

## 🎯 Cómo funciona

```
[localhost:3000]          [Fly.io Staging]           [Admin Panel]
  vercel dev      →       backend-dev        →       admin.autokufe.com/dev-logs
  Frontend logs           Redis pub/sub              WebSocket streaming
```

## 📋 Setup (una sola vez)

### 1. Instalar Vercel CLI

Ya instalado globalmente con: `npm install -g vercel`

### 2. Configurar variables en Vercel

Ve a: https://vercel.com/autokufe/web/settings/environment-variables

Configura estas variables para **Development** (checkbox):

```bash
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_API_URL=https://autokufe-backend-dev.fly.dev
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Vincular proyecto con Vercel (primera vez)

```bash
cd /home/juan/AutoKufe/web
vercel link
```

Selecciona:
- Scope: AutoKufe
- Link to existing project: Yes
- Project name: web

Esto creará `.vercel/` con la configuración.

## 🚀 Uso diario

### 1. Iniciar desarrollo local

```bash
cd /home/juan/AutoKufe/web
vercel dev
```

Abrirá en: `http://localhost:3000`

### 2. Ver logs en admin panel

1. Inicia sesión en `admin.autokufe.com` con tu cuenta dev
2. Ve a `/dev-logs`
3. Crea una sesión de dev (si no tienes)
4. Click en "Iniciar Streaming"

### 3. Usar logger en tu código

```typescript
import { devLogger } from '@/lib/dev-logger'

// En cualquier componente
function MyComponent() {
  const handleClick = () => {
    // Info log
    devLogger.info('User clicked button', {
      component: 'MyComponent',
      buttonId: 'submit'
    })
  }

  const handleError = (error: Error) => {
    // Error log
    devLogger.error('API request failed', {
      error: error.message,
      endpoint: '/api/jobs'
    })
  }

  const handleWarning = () => {
    // Warning log
    devLogger.warn('Slow operation detected', {
      duration: 5000
    })
  }

  return <button onClick={handleClick}>Click me</button>
}
```

## 📊 Ver logs en tiempo real

En el admin panel verás:

```
[12:34:56] [WEB] INFO: User clicked button
  component: MyComponent
  buttonId: submit

[12:34:57] [WEB] ERROR: API request failed
  error: Network error
  endpoint: /api/jobs
```

## ⚡ Ventajas

✅ **Hot reload** - Desarrollo rápido en local
✅ **Backend real** - Usa backend-dev completo
✅ **Logs centralizados** - Todo en un panel
✅ **Multi-tenant** - Tus logs separados de otros devs
✅ **Filtros** - Por servicio, nivel, trace_id
✅ **No pollutes browser console** - Logs solo donde importan

## 🔍 Debug Tips

### Ver logs históricos

El buffer mantiene las últimas 1000 líneas. Si reconectas el WebSocket, verás logs anteriores.

### Filtrar por servicio

En el admin panel puedes filtrar:
- `all` - Todos los servicios (web + backend + core)
- `web` - Solo frontend
- `backend` - Solo backend
- `core` - Solo core services

### Trace ID

Para seguir una operación a través de múltiples servicios:

```typescript
const traceId = crypto.randomUUID()

devLogger.info('Starting job creation', { trace_id: traceId })

// En el backend y core, también loggearán con el mismo trace_id
```

Luego filtra por `TRACE:abc-123` en el admin panel.

## ❓ Troubleshooting

### Logs no aparecen

1. Verifica que estés usando `vercel dev` (no `npm run dev`)
2. Verifica variables de entorno: `NEXT_PUBLIC_ENVIRONMENT=staging`
3. Verifica que tengas sesión activa en admin panel
4. Verifica que el WebSocket esté conectado (ícono verde)

### Session expired

Si la sesión expira (8 horas), recarga el admin panel y crea nueva sesión.

### No tengo acceso a /dev-logs

Necesitas rol `dev` o `super_admin` en la tabla `user_roles`.

## 🔐 Solo en staging

El logger solo funciona cuando `NEXT_PUBLIC_ENVIRONMENT=staging`.

En producción, `devLogger.log()` no hace nada (no envía requests).
