'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Loader2, Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  isNotificationsSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  registerServiceWorker
} from '@/lib/notifications'

type NotificationState =
  | 'loading'
  | 'unsupported'
  | 'denied'
  | 'inactive'
  | 'active'

export function NotificationBell() {
  const [state, setState] = useState<NotificationState>('loading')
  const [isOpen, setIsOpen] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const checkState = useCallback(async () => {
    if (!isNotificationsSupported()) {
      setState('unsupported')
      return
    }

    const permission = getNotificationPermission()

    if (permission === 'denied') {
      setState('denied')
      return
    }

    // Check if actually subscribed
    const subscribed = await isSubscribedToPush()
    setState(subscribed ? 'active' : 'inactive')
  }, [])

  useEffect(() => {
    checkState()
  }, [checkState])

  // Register service worker on mount
  useEffect(() => {
    if (isNotificationsSupported()) {
      registerServiceWorker()
    }
  }, [])

  const handleEnable = async () => {
    setIsToggling(true)
    try {
      const result = await subscribeToPush()
      if (result.success) {
        setState('active')
      } else if (result.error === 'Permission denied') {
        setState('denied')
      } else {
        console.error('Failed to enable notifications:', result.error)
      }
    } finally {
      setIsToggling(false)
    }
  }

  const handleDisable = async () => {
    setIsToggling(true)
    try {
      const result = await unsubscribeFromPush()
      if (result.success) {
        setState('inactive')
      }
    } finally {
      setIsToggling(false)
    }
  }

  // Don't render anything while loading to avoid flash
  if (state === 'loading') {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Button>
    )
  }

  // Don't show bell if notifications aren't supported
  if (state === 'unsupported') {
    return null
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={state === 'active' ? 'Notificaciones activas' : 'Activar notificaciones'}
        >
          {state === 'active' ? (
            <>
              <Bell className="h-5 w-5" />
              {/* Active indicator dot */}
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500" />
            </>
          ) : state === 'denied' ? (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        {state === 'active' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-green-100 p-1.5">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">Notificaciones activas</p>
                <p className="text-xs text-muted-foreground">
                  Recibiras una notificacion cuando tus trabajos terminen.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleDisable}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Desactivar notificaciones
            </Button>
          </div>
        )}

        {state === 'inactive' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-muted p-1.5">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">Notificaciones desactivadas</p>
                <p className="text-xs text-muted-foreground">
                  Activa las notificaciones para saber cuando tus trabajos terminen.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleEnable}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Activar notificaciones
            </Button>
          </div>
        )}

        {state === 'denied' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-destructive/10 p-1.5">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">Notificaciones bloqueadas</p>
                <p className="text-xs text-muted-foreground">
                  Las notificaciones estan bloqueadas en tu navegador. Para activarlas:
                </p>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5 mt-2">
                  <li>Haz clic en el icono de candado en la barra de direcciones</li>
                  <li>Busca "Notificaciones"</li>
                  <li>Cambia a "Permitir"</li>
                  <li>Recarga la pagina</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
