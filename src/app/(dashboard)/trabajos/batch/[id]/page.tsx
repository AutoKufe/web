'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  KeyRound,
  Send,
  Layers,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { useBatchDetail, useProvideToken, type BatchJob } from '@/lib/query'

// Helper: Format date without timezone shift
const formatDateOnly = (dateString: string): string => {
  if (!dateString) return 'N/A'
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString()
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  natural: 'Naturales',
  juridica: 'Juridicas',
  all: 'Todas',
}

// Inline token input for waiting_token jobs within batch
function BatchTokenInput({ job }: { job: BatchJob }) {
  const [tokenUrl, setTokenUrl] = useState('')
  const provideTokenMutation = useProvideToken()

  const handleSubmit = () => {
    if (!tokenUrl.trim()) return

    provideTokenMutation.mutate(
      { jobId: job.id, tokenUrl: tokenUrl.trim() },
      {
        onSuccess: () => {
          toast.success('Token guardado. Job en cola de procesamiento.')
          setTokenUrl('')
        },
        onError: (error) => {
          toast.error(error.message || 'Error al proporcionar token')
        },
      }
    )
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <Input
        placeholder="Pega la URL del token DIAN..."
        value={tokenUrl}
        onChange={(e) => setTokenUrl(e.target.value)}
        className="h-7 text-xs flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs px-2"
        onClick={handleSubmit}
        disabled={!tokenUrl.trim() || provideTokenMutation.isPending}
      >
        {provideTokenMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
      </Button>
    </div>
  )
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case 'pending':
    case 'queued':
      return <Clock className="h-4 w-4 text-yellow-500" />
    case 'waiting_token':
      return <KeyRound className="h-4 w-4 text-amber-500" />
    case 'failed':
    case 'creation_failed':
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    completed: { variant: 'default', label: 'Completado' },
    processing: { variant: 'secondary', label: 'Procesando' },
    pending: { variant: 'outline', label: 'Pendiente' },
    queued: { variant: 'outline', label: 'En cola' },
    waiting_token: { variant: 'outline', label: 'Esperando token' },
    failed: { variant: 'destructive', label: 'Fallido' },
    creation_failed: { variant: 'destructive', label: 'Error en creacion' },
    cancelled: { variant: 'destructive', label: 'Cancelado' },
  }
  const { variant, label } = config[status] || { variant: 'outline' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// Job row within batch detail
function BatchJobRow({ job }: { job: BatchJob }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {getStatusIcon(job.status)}
            <span className="font-medium text-sm">{job.job_name}</span>
          </div>
          {job.status === 'waiting_token' && (
            <div className="ml-6">
              <BatchTokenInput job={job} />
            </div>
          )}
          {(job.status === 'failed' || job.status === 'creation_failed') && job.error_message && (
            <p className="text-xs text-red-600 ml-6 mt-1">{job.error_message}</p>
          )}
        </div>
      </TableCell>
      <TableCell>{getStatusBadge(job.status)}</TableCell>
      <TableCell className="text-sm">
        {job.total_documents ? (
          <span>
            {job.processed_documents || 0} / {job.total_documents}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}
      </TableCell>
      <TableCell>
        <Link href={`/trabajos/${job.id}`}>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <ExternalLink className="h-3 w-3" />
            Detalle
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  )
}

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: batchId } = use(params)
  const [downloading, setDownloading] = useState(false)

  const { data, isLoading, refetch, isFetching } = useBatchDetail(batchId)

  const batch = data?.batch
  const jobs = data?.jobs || []
  const completedJobs = jobs.filter((j) => j.status === 'completed')

  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      const result = await apiClient.downloadBatchExcels(batchId)

      if (!result.success || !result.blob) {
        toast.error(result.error || 'Error descargando archivos')
        return
      }

      const url = window.URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename || `batch_${batchId.slice(0, 8)}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(
        completedJobs.length === 1
          ? 'Excel descargado correctamente'
          : `${completedJobs.length} archivos descargados como ZIP`
      )
    } catch (error) {
      console.error('Error descargando batch:', error)
      toast.error('Error al descargar los archivos')
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/trabajos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded mt-2" />
          </div>
        </div>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/trabajos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Lote no encontrado</h1>
        </div>
      </div>
    )
  }

  const categories = Array.isArray(batch.document_categories)
    ? batch.document_categories
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/trabajos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              <h1 className="text-2xl font-bold">
                Lote - {ENTITY_TYPE_LABELS[batch.entity_type_filter] || batch.entity_type_filter}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {formatDateOnly(batch.start_date)} - {formatDateOnly(batch.end_date)}
              {' | '}
              {categories.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
            </p>
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
          {completedJobs.length > 0 && (
            <Button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {completedJobs.length === 1
                ? 'Descargar Excel'
                : `Descargar ${completedJobs.length} Excel`}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{batch.total_jobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Completados</p>
            <p className="text-2xl font-bold text-green-600">{completedJobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Procesando</p>
            <p className="text-2xl font-bold text-blue-600">
              {jobs.filter((j) => j.status === 'processing').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Esperando token</p>
            <p className="text-2xl font-bold text-amber-600">
              {jobs.filter((j) => j.status === 'waiting_token').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Fallidos</p>
            <p className="text-2xl font-bold text-red-600">
              {jobs.filter((j) => ['failed', 'creation_failed', 'cancelled'].includes(j.status)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trabajos del lote</CardTitle>
          <CardDescription>
            {jobs.length} trabajo{jobs.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay trabajos en este lote
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Completado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <BatchJobRow key={job.id} job={job} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
