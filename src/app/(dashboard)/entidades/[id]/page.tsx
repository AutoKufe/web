'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { ArrowLeft, Trash2, Building2, User, Calendar, Mail, Receipt, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useEntity, useDianEmailLookup, useDeleteEntity, useUpdateEntityTaxConfig } from '@/lib/query'

// Entity type is inferred from useEntity hook

const getEntityTypeLabel = (typeCode: string): string => {
  switch (typeCode) {
    case 'juridica':
      return 'Persona Juridica'
    case 'natural':
      return 'Persona Natural'
    default:
      return typeCode
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
  const entityId = params.id as string

  // React Query hooks
  const { data: entity, isLoading, error } = useEntity(entityId)
  const dianEmail = useDianEmailLookup(entity?.dian_email_id)
  const deleteMutation = useDeleteEntity()
  const updateTaxConfigMutation = useUpdateEntityTaxConfig()

  // Tax configuration local state
  const [taxConfig, setTaxConfig] = useState({
    ciiu: '',
    contributor_type: 'ordinario' as 'ordinario' | 'gran_contribuyente' | 'regimen_simple',
    is_iva_responsible: true,
    is_withholding_agent: true,
    is_self_withholder: true,
  })
  const [taxConfigDirty, setTaxConfigDirty] = useState(false)

  // Sync tax config from entity data
  useEffect(() => {
    if (entity) {
      setTaxConfig({
        ciiu: entity.ciiu || '',
        contributor_type: entity.contributor_type || 'ordinario',
        is_iva_responsible: entity.is_iva_responsible ?? true,
        is_withholding_agent: entity.is_withholding_agent ?? true,
        is_self_withholder: entity.is_self_withholder ?? true,
      })
      setTaxConfigDirty(false)
    }
  }, [entity])

  const handleTaxConfigChange = <K extends keyof typeof taxConfig>(
    field: K,
    value: typeof taxConfig[K]
  ) => {
    setTaxConfig((prev) => ({ ...prev, [field]: value }))
    setTaxConfigDirty(true)
  }

  const handleSaveTaxConfig = async () => {
    try {
      await updateTaxConfigMutation.mutateAsync({
        entityId,
        config: {
          ciiu: taxConfig.ciiu || null,
          contributor_type: taxConfig.contributor_type,
          is_iva_responsible: taxConfig.is_iva_responsible,
          is_withholding_agent: taxConfig.is_withholding_agent,
          is_self_withholder: taxConfig.is_self_withholder,
        },
      })
      toast.success('Configuracion tributaria actualizada')
      setTaxConfigDirty(false)
    } catch (err) {
      console.error('Error updating tax config:', err)
      toast.error(err instanceof Error ? err.message : 'Error actualizando configuracion')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(entityId)
      toast.success('Entidad eliminada exitosamente')
      router.push('/entidades')
    } catch (err) {
      console.error('Error deleting entity:', err)
      toast.error(err instanceof Error ? err.message : 'Error eliminando entidad')
    }
  }

  if (isLoading) {
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

  if (error || !entity) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Entidad no encontrada</p>
        <Button onClick={() => router.push('/entidades')}>
          Volver a Entidades
        </Button>
      </div>
    )
  }

  const EntityIcon = entity.type_code === 'juridica' ? Building2 : User
  const dianBadge = dianEmail ? getDianEmailBadge(dianEmail.auth_status) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/entidades')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{entity.display_name}</h1>
            <p className="text-muted-foreground text-sm">
              {getEntityTypeLabel(entity.type_code)} · ****{entity.identifier_suffix}
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
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Si, eliminar'}
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
              Informacion Basica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Nombre</p>
              <p className="font-medium">{entity.display_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Tipo</p>
              <Badge variant="outline">{getEntityTypeLabel(entity.type_code)}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Identificador</p>
              <p className="font-mono text-sm">****{entity.identifier_suffix}</p>
            </div>
          </CardContent>
        </Card>

        {/* DIAN Email Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gestion Automatica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dianEmail ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estado</p>
                  {dianBadge && (
                    <Badge variant={dianBadge.variant}>{dianBadge.label}</Badge>
                  )}
                </div>
                {dianEmail.email_masked && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email DIAN</p>
                    <p className="font-mono text-sm">{dianEmail.email_masked}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay gestion automatica configurada
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tax Configuration Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Configuracion Tributaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* CIIU */}
              <div className="space-y-2">
                <Label htmlFor="ciiu">Codigo CIIU</Label>
                <Input
                  id="ciiu"
                  value={taxConfig.ciiu}
                  placeholder="Ej: 5611"
                  onChange={(e) => handleTaxConfigChange('ciiu', e.target.value)}
                  maxLength={5}
                />
                <p className="text-xs text-muted-foreground">
                  Actividad economica principal (4-5 digitos)
                </p>
              </div>

              {/* Contributor Type */}
              <div className="space-y-2">
                <Label htmlFor="contributor_type">Tipo de Contribuyente</Label>
                <Select
                  value={taxConfig.contributor_type}
                  onValueChange={(value) =>
                    handleTaxConfigChange(
                      'contributor_type',
                      value as 'ordinario' | 'gran_contribuyente' | 'regimen_simple'
                    )
                  }
                >
                  <SelectTrigger id="contributor_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinario">Regimen Ordinario</SelectItem>
                    <SelectItem value="gran_contribuyente">Gran Contribuyente</SelectItem>
                    <SelectItem value="regimen_simple">Regimen Simple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_iva_responsible"
                  checked={taxConfig.is_iva_responsible}
                  onCheckedChange={(checked) =>
                    handleTaxConfigChange('is_iva_responsible', checked === true)
                  }
                />
                <Label htmlFor="is_iva_responsible" className="cursor-pointer">
                  Responsable de IVA
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_withholding_agent"
                  checked={taxConfig.is_withholding_agent}
                  onCheckedChange={(checked) =>
                    handleTaxConfigChange('is_withholding_agent', checked === true)
                  }
                />
                <Label htmlFor="is_withholding_agent" className="cursor-pointer">
                  Agente Retenedor
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_self_withholder"
                  checked={taxConfig.is_self_withholder}
                  onCheckedChange={(checked) =>
                    handleTaxConfigChange('is_self_withholder', checked === true)
                  }
                />
                <Label htmlFor="is_self_withholder" className="cursor-pointer">
                  Autorretenedor
                </Label>
              </div>
            </div>

            <Button
              onClick={handleSaveTaxConfig}
              disabled={!taxConfigDirty || updateTaxConfigMutation.isPending}
            >
              {updateTaxConfigMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuracion'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Timestamps Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas y Actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Fecha de creacion</p>
              <p className="text-sm font-medium">
                {new Date(entity.created_at).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Ultimo uso</p>
              <p className="text-sm font-medium">
                {entity.last_used_at
                  ? new Date(entity.last_used_at).toLocaleString('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'Nunca'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Ultimo token recibido</p>
              <p className="text-sm font-medium">
                {entity.last_token_received_at
                  ? new Date(entity.last_token_received_at).toLocaleString('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'Nunca'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
