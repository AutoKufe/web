'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface Job {
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
  docs_processed?: number
  docs_total?: number
  created_at: string
  completed_at?: string
}

export default function JobsPage() {
  const { user, loading: authLoading } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchJobs = async (currentPage = 1, showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await apiClient.listJobs(currentPage, 10)
      if (response && !response.error) {
        const data = response as any
        const jobsList = data.jobs || []

        // Map backend response to frontend Job interface
        const mappedJobs = await Promise.all(jobsList.map(async (job: any) => {
          // Fetch entity data for each job
          let entityName = 'N/A'
          let entityNit = undefined

          if (job.entity_id) {
            try {
              const entityResponse = await apiClient.getEntity(job.entity_id) as any
              if (entityResponse && !entityResponse.error && entityResponse.entity) {
                entityName = entityResponse.entity.name || 'N/A'
                entityNit = entityResponse.entity.identifier?.slice(-4)
              }
            } catch {
              // Silently fail, use N/A
            }
          }

          return {
            id: job.job_id || job.id,  // Backend uses job_id in JobProgressResponse
            job_name: job.job_name,
            status: job.status,
            entity_name: entityName,
            entity_nit: entityNit ? `****${entityNit}` : undefined,
            date_range: {
              start_date: job.start_date,
              end_date: job.end_date
            },
            docs_processed: job.processed_documents,
            docs_total: job.total_documents,
            created_at: job.created_at,
            completed_at: job.completed_at
          }
        }))

        setJobs(mappedJobs)
        const total = data.total_count || 0
        const pageSize = data.per_page || 10
        setTotalPages(Math.ceil(total / pageSize))
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
      toast.error('Error cargando jobs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    fetchJobs(page)
  }, [page, authLoading, user])

  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === 'processing' || job.status === 'pending'
    )

    if (hasActiveJobs) {
      const interval = setInterval(() => {
        fetchJobs(page, true)
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [jobs, page])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'failed':
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
      failed: { variant: 'destructive', label: 'Fallido' },
    }
    const { variant, label } = config[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  const formatDateRange = (job: Job) => {
    if (!job.date_range) return 'N/A'
    const start = new Date(job.date_range.start_date).toLocaleDateString()
    const end = new Date(job.date_range.end_date).toLocaleDateString()
    return `${start} - ${end}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">
            Gestiona tus trabajos de procesamiento DIAN
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchJobs(page, true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/jobs/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Job
            </Button>
          </Link>
        </div>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Jobs</CardTitle>
          <CardDescription>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} encontrado{jobs.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No tienes jobs aún</p>
              <Link href="/jobs/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer job
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
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className="font-medium">{job.job_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {job.entity_name || 'N/A'}
                          </p>
                          {job.entity_nit && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {job.entity_nit}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateRange(job)}
                      </TableCell>
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
                              <Link href={`/jobs/${job.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver detalles
                              </Link>
                            </DropdownMenuItem>
                            {job.status === 'completed' && (
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Descargar Excel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
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
                    Página {page} de {totalPages}
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
