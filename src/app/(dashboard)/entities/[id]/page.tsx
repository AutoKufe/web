'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Trash2, Building2, User, Calendar, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface Entity {
  id: string
  display_name: string
  identifier_suffix: string
  entity_type: string
  created_at: string
  last_used_at?: string
  dian_email?: {
    email_masked?: string
    status: string
    message: string
  }
}

const getEntityTypeLabel = (type: string): string => {
  switch (type) {
    case 'juridica':
      return 'Persona Jurídica'
    case 'natural':
      return 'Persona Natural'
    default:
      return type
  }
}

const getDianEmailBadge = (status: string) => {
  switch (status) {
    case 'active':
      return { variant: 'default' as const, label: 'Auto activa' }
    case 'oauth_expired':
      return { variant: 'destructive' as const, label: 'OAuth expirado' }
    case 'oauth_revoked':
      return { variant: 'destructive' as const, label: 'OAuth revocado' }
    case 'not_associated':
      return { variant: 'secondary' as const, label: 'Sin email' }
    default:
      return { variant: 'outline' as const, label: 'Desconocido' }
  }
}

export default function EntityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const [entity, setEntity] = useState<Entity | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const entityId = params.id as string

  useEffect(() => {
    if (authLoading || !user) return
    fetchEntity()
  }, [authLoading, user, entityId])

  const fetchEntity = async () => {
    setLoading(true)
    try {
      const response = await apiClient.getEntity(entityId)
      if (response && !response.error) {
        const data = response as { entity: Entity }
        setEntity(data.entity)
      } else {
        toast.error('Entidad no encontrada')
        router.push('/entities')
      }
    } catch (err) {
      console.error('Error fetching entity:', err)
      toast.error('Error cargando entidad')
      router.push('/entities')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await apiClient.deleteEntity(entityId)
      if (response && !response.error) {
        toast.success('Entidad eliminada exitosamente')
        router.push('/entities')
      } else {
        toast.error(response?.message || 'Error eliminando entidad')
      }
    } catch (err) {
      console.error('Error deleting entity:', err)
      toast.error('Error eliminando entidad')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!entity) {
    return null
  }

  const entityIcon = entity.entity_type === 'juridica' ? Building2 : User
  const EntityIcon = entityIcon
  const dianBadge = entity.dian_email ? getDianEmailBadge(entity.dian_email.status) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/entities')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{entity.display_name}</h1>
            <p className="text-muted-foreground text-sm">
              {getEntityTypeLabel(entity.entity_type)} · ***{entity.identifier_suffix}
            </p>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Eliminar Entidad
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente la entidad
                <strong> {entity.display_name}</strong> y todos sus datos asociados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Entity Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EntityIcon className="h-5 w-5" />
              Información Básica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{entity.display_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <Badge variant="outline">{getEntityTypeLabel(entity.entity_type)}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Identificador</p>
              <p className="font-mono">***{entity.identifier_suffix}</p>
            </div>
          </CardContent>
        </Card>

        {/* DIAN Email Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gestión Automática
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entity.dian_email ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {dianBadge && (
                    <Badge variant={dianBadge.variant}>{dianBadge.label}</Badge>
                  )}
                </div>
                {entity.dian_email.email_masked && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email DIAN</p>
                    <p className="font-mono text-sm">{entity.dian_email.email_masked}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Mensaje</p>
                  <p className="text-sm">{entity.dian_email.message}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay gestión automática configurada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Timestamps Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Fecha de creación</p>
              <p className="text-sm">
                {new Date(entity.created_at).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            </div>
            {entity.last_used_at && (
              <div>
                <p className="text-sm text-muted-foreground">Último uso</p>
                <p className="text-sm">
                  {new Date(entity.last_used_at).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
