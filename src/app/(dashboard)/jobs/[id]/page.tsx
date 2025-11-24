'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface JobDetails {
  job_id: string
  entity_id: string
  job_name: string
  status: string
  start_date: string
  end_date: string
  document_categories?: string
  consolidation_interval?: string
  processed_documents?: number
  total_documents?: number
  created_at: string
  processing_start_time?: string
  completed_at?: string
  error_message?: string
  stage?: string
  progress_percentage?: number
}

interface EntityDetails {
  full_name: string
  identifier_suffix: string
  type: string
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading: authLoading } = useAuth()
  const [job, setJob] = useState<JobDetails | null>(null)
  const [entity, setEntity] = useState<EntityDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchJobStatus = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      const response = await apiClient.getJobStatus(id)
      if (response && !response.error) {
        const jobData = response as unknown as JobDetails
        setJob(jobData)

        // Fetch entity data separately
        if (jobData.entity_id) {
          const entityResponse = await apiClient.getEntity(jobData.entity_id) as any
          if (entityResponse && !entityResponse.error && entityResponse.entity) {
            setEntity({
              full_name: entityResponse.entity.name || 'N/A',
              identifier_suffix: entityResponse.entity.identifier?.slice(-4) || 'N/A',
              type: entityResponse.entity.type_code || 'N/A'
            })
          }
        }
      } else {
        toast.error('Error cargando estado del job')
      }
    } catch (err) {
      console.error('Error fetching job status:', err)
      toast.error('Error cargando estado del job')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    fetchJobStatus()
  }, [id, authLoading, user])

  useEffect(() => {
    if (job && (job.status === 'processing' || job.status === 'pending')) {
      const interval = setInterval(() => {
        fetchJobStatus(true)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [job])

  const getStatusIcon = (status: string, size = 'h-5 w-5') => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className={`${size} text-green-500`} />
      case 'processing':
        return <Loader2 className={`${size} text-blue-500 animate-spin`} />
      case 'pending':
        return <Clock className={`${size} text-yellow-500`} />
      case 'failed':
        return <XCircle className={`${size} text-red-500`} />
      default:
        return <Clock className={`${size} text-muted-foreground`} />
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      completed: { variant: 'default', label: 'Completado' },
      processing: { variant: 'secondary', label: 'Procesando' },
      queued: { variant: 'secondary', label: 'En Cola' },
      pending: { variant: 'outline', label: 'Pendiente' },
      failed: { variant: 'destructive', label: 'Fallido' },
    }
    const { variant, label } = config[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={variant} className="text-base px-3 py-1">{label}</Badge>
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Job no encontrado</p>
              <Link href="/jobs">
                <Button>Volver a Jobs</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/jobs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{job.job_name}</h1>
              {getStatusBadge(job.status)}
            </div>
            <p className="text-muted-foreground">
              ID: {job.job_id?.slice(0, 8) || 'N/A'}...
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchJobStatus(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          {job.status === 'completed' && (
            <Button className="gap-2">
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
              {job.total_documents && job.total_documents > 0 && (
                <p className="text-sm">
                  Documentos: <strong>{job.processed_documents || 0}</strong> de <strong>{job.total_documents}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Card */}
      {job.status === 'failed' && job.error_message && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{job.error_message}</p>
          </CardContent>
        </Card>
      )}

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Job</CardTitle>
          <CardDescription>
            Información de configuración y ejecución
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Info */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Entidad
            </h3>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">{entity?.full_name || 'Cargando...'}</p>
              {entity?.identifier_suffix && (
                <p className="text-sm text-muted-foreground font-mono">
                  Últimos 4 dígitos: {entity.identifier_suffix}
                </p>
              )}
              {entity?.type && (
                <p className="text-sm text-muted-foreground capitalize">
                  Tipo: {entity.type.replace('_', ' ')}
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
                  {job.start_date
                    ? new Date(job.start_date).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Fin</p>
                <p className="font-medium">
                  {job.end_date
                    ? new Date(job.end_date).toLocaleDateString()
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
              Configuración
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Categorías de documentos</p>
                <p className="font-medium capitalize">{job.document_categories || 'Todos'}</p>
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

          {/* Documents Processed */}
          {job.status === 'completed' && job.total_documents && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Resultado
                </h3>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <p className="font-medium text-green-700 dark:text-green-300">
                      {job.processed_documents || job.total_documents} documentos procesados
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
