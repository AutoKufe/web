'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Building2,
  Calendar,
  FileText,
  AlertCircle,
  Info,
  Ban,
  Send
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useJob,
  useEntity,
  useCancelJob,
  useMarkJobAsFailed,
  useProvideToken,
} from '@/lib/query'


// Helper: Format document categories with proper "y" conjunction
// Input: ['ingresos', 'egresos', 'nominas'] or "ingresosegresosnominas"
// Output: "Ingresos, Egresos y Nominas"
function formatDocumentCategories(categories: string | string[] | undefined | null): string {
  if (!categories) return 'Todos'

  const categoryMap: Record<string, string> = {
    'ingresos': 'Ingresos',
    'egresos': 'Egresos',
    'nominas': 'Nominas'
  }

  const joinWithY = (items: string[]): string => {
    if (items.length === 0) return ''
    if (items.length === 1) return items[0]
    if (items.length === 2) return items.join(' y ')

    const lastItem = items[items.length - 1]
    const beforeLast = items.slice(0, -1)
    return beforeLast.join(', ') + ' y ' + lastItem
  }

  // If it's an array, map directly
  if (Array.isArray(categories)) {
    const formatted = categories.map(cat => categoryMap[cat.toLowerCase()] || cat)
    return joinWithY(formatted)
  }

  // If it's a string, parse it
  if (typeof categories === 'string') {
    const parts: string[] = []
    const remaining = categories.toLowerCase()

    for (const [key, label] of Object.entries(categoryMap)) {
      if (remaining.includes(key)) {
        parts.push(label)
      }
    }

    return parts.length > 0 ? joinWithY(parts) : categories
  }

  return 'Todos'
}

// Helper: Format date without timezone shift (fix -1 day bug)
// Input: "2025-01-01" from DB → Output: "1/1/2025"
function formatDateOnly(dateString: string | undefined | null): string {
  if (!dateString || typeof dateString !== 'string') return 'N/A'

  // Parse as local date (not UTC) to avoid timezone shift
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  return date.toLocaleDateString()
}

const getStatusIcon = (status: string, size = 'h-5 w-5') => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={`${size} text-green-500`} />
    case 'processing':
      return <Loader2 className={`${size} text-blue-500 animate-spin`} />
    case 'pending':
    case 'queued':
      return <Clock className={`${size} text-yellow-500`} />
    case 'waiting_token':
      return <AlertCircle className={`${size} text-orange-500`} />
    case 'failed':
      return <XCircle className={`${size} text-red-500`} />
    default:
      return <Clock className={`${size} text-muted-foreground`} />
  }
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
    completed: { variant: 'default', label: 'Completado' },
    processing: { variant: 'secondary', label: 'Procesando' },
    queued: { variant: 'secondary', label: 'En Cola' },
    pending: { variant: 'outline', label: 'Pendiente' },
    waiting_token: { variant: 'outline', label: 'Requiere Token', className: 'border-orange-500 text-orange-600' },
    failed: { variant: 'destructive', label: 'Fallido' },
  }
  const { variant, label, className } = config[status] || { variant: 'outline' as const, label: status }
  return <Badge variant={variant} className={`text-base px-3 py-1 ${className || ''}`}>{label}</Badge>
}

const getEntityTypeLabel = (typeCode: string) => {
  const types: Record<string, string> = {
    'persona_juridica': 'Persona Juridica',
    'juridica': 'Persona Juridica',
    'persona_natural': 'Persona Natural',
    'natural': 'Persona Natural'
  }
  return types[typeCode.toLowerCase()] || typeCode
}

const formatIdentifier = (suffix: string) => {
  return `****${suffix}`
}


export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // React Query hooks
  const { data: job, isLoading, isFetching, refetch, error } = useJob(id)

  // Get entity data from cache or fetch if needed
  const { data: entity } = useEntity(job?.entity_id)

  // Mutations
  const cancelMutation = useCancelJob()
  const markFailedMutation = useMarkJobAsFailed()
  const provideTokenMutation = useProvideToken()

  // Local state for token input
  const [newTokenUrl, setNewTokenUrl] = useState('')

  // Check if we're in staging/dev environment (show dev tools)
  const isDevEnvironment = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('dev.') ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging'
  )

  const handleCancelJob = async () => {
    if (!confirm('Estas seguro de que quieres cancelar este trabajo? Esta accion no se puede deshacer.')) {
      return
    }

    try {
      await cancelMutation.mutateAsync(id)
      toast.success('Trabajo cancelado exitosamente')
    } catch (err) {
      console.error('Error cancelling job:', err)
      toast.error(err instanceof Error ? err.message : 'Error cancelando trabajo')
    }
  }

  const handleMarkFailed = async () => {
    if (!confirm('[DEV] Marcar este trabajo como fallido? Esto es solo para testing.')) {
      return
    }

    try {
      await markFailedMutation.mutateAsync(id)
      toast.success('[DEV] Trabajo marcado como fallido')
    } catch (err) {
      console.error('Error marking job as failed:', err)
      toast.error(err instanceof Error ? err.message : 'Error marcando trabajo como fallido')
    }
  }

  const handleProvideToken = async () => {
    if (!newTokenUrl.trim()) {
      toast.error('Por favor ingresa una URL de token valida')
      return
    }

    // Validate it looks like a DIAN token URL
    if (!newTokenUrl.includes('dian.gov.co') && !newTokenUrl.includes('muisca.dian.gov.co')) {
      toast.error('La URL debe ser del portal DIAN (dian.gov.co)')
      return
    }

    try {
      await provideTokenMutation.mutateAsync({ jobId: id, tokenUrl: newTokenUrl.trim() })
      toast.success('Token DIAN aceptado. Reanudando procesamiento...')
      setNewTokenUrl('')
    } catch (err) {
      console.error('Error providing token:', err)
      toast.error(err instanceof Error ? err.message : 'Error al enviar el token')
    }
  }

  const handleDownload = async () => {
    if (!job) return

    try {
      const result = await apiClient.downloadExcel(job.id)

      if (!result.success || !result.blob) {
        toast.error(result.error || 'Error al descargar el archivo')
        return
      }

      const url = window.URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename || `${job.job_name}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Archivo descargado correctamente')
    } catch (error) {
      console.error('Error descargando Excel:', error)
      toast.error('Error al descargar el archivo')
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Trabajo no encontrado</p>
              <Link href="/trabajos">
                <Button>Volver a Lista de Trabajos</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isActiveJob = ['processing', 'pending', 'queued', 'waiting_token'].includes(job.status)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/trabajos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{job.job_name}</h1>
              {getStatusBadge(job.status)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {isActiveJob && (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={handleCancelJob}
                disabled={cancelMutation.isPending}
              >
                <Ban className="h-4 w-4" />
                {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar Trabajo'}
              </Button>
              {isDevEnvironment && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
                  onClick={handleMarkFailed}
                  disabled={markFailedMutation.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  {markFailedMutation.isPending ? 'Marcando...' : '[DEV] Marcar Fallido'}
                </Button>
              )}
            </>
          )}
          {job.status === 'completed' && (
            <Button className="gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Descargar Excel
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card (only for active jobs) */}
      {(job.status === 'processing' || job.status === 'pending' || job.status === 'queued') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(job.status)}
              Progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {job.stage && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">{job.stage}</span>
                      <span className="text-sm text-muted-foreground">
                        {job.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${job.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
              {job.docs_total && job.docs_total > 0 && (
                <p className="text-sm">
                  Documentos: <strong>{job.docs_processed || 0}</strong> de <strong>{job.docs_total}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting Token Card */}
      {job.status === 'waiting_token' && (
        <Card className="border-orange-500">
          <CardContent className="py-4 px-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-orange-600">Se requiere nuevo Token DIAN</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    El token DIAN expiro durante el procesamiento del trabajo. Para continuar, obten un nuevo token desde el portal DIAN y pegalo abajo.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-url" className="text-sm font-medium">
                    URL del Token DIAN
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="token-url"
                      type="url"
                      placeholder="https://catalogo-vpfe.dian.gov.co/..."
                      value={newTokenUrl}
                      onChange={(e) => setNewTokenUrl(e.target.value)}
                      disabled={provideTokenMutation.isPending}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleProvideToken}
                      disabled={provideTokenMutation.isPending || !newTokenUrl.trim()}
                      className="gap-2"
                    >
                      {provideTokenMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pega la URL completa del token que copiaste del portal DIAN
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Card */}
      {job.status === 'failed' && job.error_message && (
        <Card className="border-destructive">
          <CardContent className="py-1 px-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div className="space-y-3">
                  <h3 className="font-semibold text-destructive">Error al realizar el trabajo</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ha ocurrido un error durante el procesamiento. Nuestro equipo tecnico ha sido notificado automaticamente y trabajara en resolverlo.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Si despues de unas horas no ves cambios, puedes contactar a soporte con este codigo de referencia para consultar el estado:
                  </p>
                  {job.error_code && (
                    <div className="bg-muted/50 rounded p-3 border">
                      <p className="text-sm font-mono">
                        <span className="text-muted-foreground">Codigo:</span>{' '}
                        <span className="font-semibold">{job.error_code}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Job</CardTitle>
          <CardDescription>
            Informacion de configuracion y ejecucion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Info */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Entidad
            </h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium">{entity?.display_name || job.entity_name || 'Cargando...'}</p>
              {entity?.identifier_suffix && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground font-mono">
                    Identificador: {formatIdentifier(entity.identifier_suffix)}
                  </p>
                  <div className="group relative">
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                      Los ultimos 4 digitos del numero de identificacion de la entidad
                    </div>
                  </div>
                </div>
              )}
              {entity?.entity_type && (
                <p className="text-sm text-muted-foreground">
                  Tipo: {getEntityTypeLabel(entity.entity_type)}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Date Range */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Rango de Fechas
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Inicio</p>
                <p className="font-medium">
                  {job.date_range?.start_date
                    ? formatDateOnly(job.date_range.start_date)
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Fin</p>
                <p className="font-medium">
                  {job.date_range?.end_date
                    ? formatDateOnly(job.date_range.end_date)
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Configuration */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Configuracion
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Categorias de documentos</p>
                <p className="font-medium capitalize">{formatDocumentCategories(job.document_categories)}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Intervalo</p>
                <p className="font-medium capitalize">
                  {job.consolidation_interval || 'Total'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tiempos
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Creado</p>
                <p className="font-medium text-sm">
                  {new Date(job.created_at).toLocaleString()}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Iniciado</p>
                <p className="font-medium text-sm">
                  {job.processing_start_time
                    ? new Date(job.processing_start_time).toLocaleString()
                    : '-'}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Completado</p>
                <p className="font-medium text-sm">
                  {job.completed_at
                    ? new Date(job.completed_at).toLocaleString()
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Documents Statistics */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Total encontrados</p>
                <p className="font-medium text-lg">
                  {job.docs_total !== undefined && job.docs_total !== null
                    ? job.docs_total.toLocaleString()
                    : 'Calculando...'}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Unicos (cobrados)</p>
                <p className="font-medium text-lg">
                  {job.docs_unique !== undefined && job.docs_unique !== null
                    ? job.docs_unique.toLocaleString()
                    : job.docs_total !== undefined && job.docs_total !== null
                      ? job.docs_total.toLocaleString()
                      : 'Calculando...'}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Procesados</p>
                <p className="font-medium text-lg">
                  {job.docs_processed !== undefined && job.docs_processed !== null
                    ? job.docs_processed.toLocaleString()
                    : '0'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
