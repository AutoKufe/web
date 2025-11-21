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
  id: string
  job_name: string
  status: string
  entity_name?: string
  entity_nit?: string
  date_range?: {
    start_date: string
    end_date: string
  }
  document_filter?: string
  consolidation_interval?: string
  docs_processed?: number
  docs_total?: number
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
  progress?: {
    stage: string
    percentage: number
    message: string
  }
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading: authLoading } = useAuth()
  const [job, setJob] = useState<JobDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchJobStatus = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      const response = await apiClient.getJobStatus(id)
      if (response && !response.error) {
        setJob(response as unknown as JobDetails)
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
              ID: {job.id.slice(0, 8)}...
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
      {(job.status === 'processing' || job.status === 'pending') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(job.status)}
              Progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {job.progress && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">{job.progress.stage}</span>
                      <span className="text-sm text-muted-foreground">
                        {job.progress.percentage}%
                      </span>
                    </div>
                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${job.progress.percentage}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {job.progress.message}
                  </p>
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
              <p className="font-medium">{job.entity_name || 'N/A'}</p>
              {job.entity_nit && (
                <p className="text-sm text-muted-foreground font-mono">
                  NIT: {job.entity_nit}
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
                  {job.date_range
                    ? new Date(job.date_range.start_date).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Fin</p>
                <p className="font-medium">
                  {job.date_range
                    ? new Date(job.date_range.end_date).toLocaleDateString()
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
                <p className="text-xs text-muted-foreground">Filtro de documentos</p>
                <p className="font-medium capitalize">{job.document_filter || 'Todos'}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Intervalo</p>
                <p className="font-medium capitalize">
                  {job.consolidation_interval || 'Mensual'}
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
                  {job.started_at
                    ? new Date(job.started_at).toLocaleString()
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
          {job.status === 'completed' && job.docs_total && (
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
                      {job.docs_processed || job.docs_total} documentos procesados
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
