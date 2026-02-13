'use client'

import { useState } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Plus,
  RefreshCw,
  MoreHorizontal,
  ExternalLink,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  KeyRound,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { useJobsWithPolling, useEntityFromList, useProvideToken, type Job } from '@/lib/query'
import { JobTableSkeleton } from '@/components/skeletons'

// Error code translations and actions
interface ErrorCodeInfo {
  message: string
  actionLabel?: string
  getActionUrl?: (job: Job) => string
}

const ERROR_CODES: Record<string, ErrorCodeInfo> = {
  DIAN_EMAIL_AUTH_EXPIRED: {
    message: 'La autorizacion para acceder al correo DIAN asociado a esta entidad ha expirado.',
    actionLabel: 'Reautorizar email DIAN',
    getActionUrl: (job) => `/entidades/${job.entity_id}/edit?tab=email`
  },
  DIAN_EMAIL_NOT_AUTHORIZED: {
    message: 'El correo DIAN asociado a esta entidad no esta autorizado para gestion automatica.',
    actionLabel: 'Autorizar email DIAN',
    getActionUrl: (job) => `/entidades/${job.entity_id}/edit?tab=email`
  },
  DIAN_EMAIL_NOT_FOUND: {
    message: 'No se encontro un correo DIAN asociado a esta entidad.',
    actionLabel: 'Configurar email DIAN',
    getActionUrl: (job) => `/entidades/${job.entity_id}/edit?tab=email`
  },
  ENTITY_NOT_FOUND: {
    message: 'La entidad asociada a este trabajo no fue encontrada.'
  },
  INVALID_DATE_RANGE: {
    message: 'El rango de fechas especificado no es valido.'
  },
  TOKEN_REQUEST_FAILED: {
    message: 'La solicitud de token DIAN fallo. Verifica que el correo DIAN este correctamente autorizado.',
    actionLabel: 'Verificar autorizacion',
    getActionUrl: (job) => `/entidades/${job.entity_id}/edit?tab=email`
  },
  TOKEN_REQUEST_TIMEOUT: {
    message: 'La solicitud de token DIAN excedio el tiempo de espera.',
  },
  BACKGROUND_TASK_ERROR: {
    message: 'Error interno al procesar la solicitud de token DIAN.'
  },
  WORKFLOW_ERROR: {
    message: 'Error inesperado durante la creacion del trabajo.'
  }
}

// Helper: Format date without timezone shift
const formatDateOnly = (dateString: string): string => {
  if (!dateString) return 'N/A'
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString()
}

// Inline token input for waiting_token jobs
function TokenInput({ job }: { job: Job }) {
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
    <div className="flex items-center gap-2 mt-2 ml-6">
      <KeyRound className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <Input
        placeholder="Pega la URL del token DIAN..."
        value={tokenUrl}
        onChange={(e) => setTokenUrl(e.target.value)}
        className="h-7 text-xs flex-1 max-w-[400px]"
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

// Job row component that handles entity lookup
function JobRow({ job }: { job: Job }) {
  const [downloading, setDownloading] = useState(false)

  // Get entity from cache if needed
  const cachedEntity = useEntityFromList(job.entity_id)
  const entityName = job.entity_name || cachedEntity?.display_name || 'N/A'
  const entityNit = cachedEntity?.identifier_suffix
    ? `****${cachedEntity.identifier_suffix}`
    : undefined

  const getStatusIcon = (status: string) => {
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
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      completed: { variant: 'default', label: 'Completado' },
      processing: { variant: 'secondary', label: 'Procesando' },
      pending: { variant: 'outline', label: 'Pendiente' },
      queued: { variant: 'outline', label: 'En cola' },
      waiting_token: { variant: 'outline', label: 'Esperando token' },
      failed: { variant: 'destructive', label: 'Fallido' },
      creation_failed: { variant: 'destructive', label: 'Error en creacion' },
    }
    const { variant, label } = config[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  const formatDateRange = () => {
    if (!job.date_range) return 'N/A'
    const start = formatDateOnly(job.date_range.start_date)
    const end = formatDateOnly(job.date_range.end_date)
    return `${start} - ${end}`
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const result = await apiClient.downloadExcel(job.id)

      if (!result.success || !result.blob) {
        toast.error(result.error || 'Error descargando Excel')
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
      toast.success('Excel descargado correctamente')
    } catch (error) {
      console.error('Error descargando Excel:', error)
      toast.error('Error al descargar el Excel')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {getStatusIcon(job.status)}
            <span className="font-medium">{job.job_name}</span>
          </div>
          {job.status === 'waiting_token' && (
            <TokenInput job={job} />
          )}
          {job.status === 'creation_failed' && job.error_code && (
            <div className="ml-6 mt-1">
              <p className="text-xs text-red-600">
                {ERROR_CODES[job.error_code]?.message || `Error desconocido: ${job.error_code}`}
              </p>
              {ERROR_CODES[job.error_code]?.actionLabel && ERROR_CODES[job.error_code]?.getActionUrl && (
                <Link href={ERROR_CODES[job.error_code].getActionUrl!(job)} className="inline-block mt-1">
                  <Button size="sm" variant="outline" className="h-6 text-xs">
                    {ERROR_CODES[job.error_code].actionLabel}
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium truncate max-w-[200px]">{entityName}</p>
          {entityNit && (
            <p className="text-xs text-muted-foreground font-mono">{entityNit}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">{formatDateRange()}</TableCell>
      <TableCell>{getStatusBadge(job.status)}</TableCell>
      <TableCell>
        {job.docs_total ? (
          <span className="text-sm">
            {job.docs_processed || 0} / {job.docs_total}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {new Date(job.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/trabajos/${job.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver detalles
              </Link>
            </DropdownMenuItem>
            {job.status === 'completed' && (
              <DropdownMenuItem onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Descargar Excel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export default function JobsPage() {
  const [page, setPage] = useState(1)

  // React Query with auto-polling for active jobs
  const { data, isLoading, isFetching, refetch } = useJobsWithPolling(page, 10)

  const jobs = data?.jobs || []
  const totalPages = data?.totalPages || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trabajos</h1>
          <p className="text-muted-foreground">
            Gestiona tus trabajos de procesamiento DIAN
          </p>
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
          <Link href="/trabajos/nuevo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Trabajo
            </Button>
          </Link>
        </div>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Trabajos</CardTitle>
          <CardDescription>
            {data?.totalCount || 0} trabajo{(data?.totalCount || 0) !== 1 ? 's' : ''} encontrado{(data?.totalCount || 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Rango</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <JobTableSkeleton rows={5} />
              </TableBody>
            </Table>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No tienes trabajos aun</p>
              <Link href="/trabajos/nuevo">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer trabajo
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Rango</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <JobRow key={job.id} job={job} />
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Pagina {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
