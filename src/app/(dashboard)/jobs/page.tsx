'use client'

import { useEffect, useState, useRef } from 'react'
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

// Cache configuration
const JOBS_CACHE_KEY = 'jobs_list_cache'
const JOBS_CACHE_TTL = 30000 // 30 seconds cache
const POLLING_INTERVAL = 30000 // Poll every 30 seconds (reduced from 10s)
const ENTITIES_CACHE_KEY = 'autokufe_entities_cache_global' // Same key as entities page

interface Job {
  id: string
  job_name: string
  status: string
  entity_id?: string  // Store entity_id to lookup in entities cache
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


interface Entity {
  id: string
  display_name: string
  identifier_suffix: string
  entity_type: string
  updated_at?: string
}

interface EntitiesCache {
  entities: Entity[]
  total_count: number
}

interface JobsCache {
  jobs: Job[]
  totalPages: number
  page: number
  timestamp: number
}

// Cache helpers
const getJobsCache = (page: number): JobsCache | null => {
  try {
    const cached = localStorage.getItem(`${JOBS_CACHE_KEY}_page_${page}`)
    if (!cached) return null

    const data: JobsCache = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is still valid
    if (now - data.timestamp > JOBS_CACHE_TTL) {
      localStorage.removeItem(`${JOBS_CACHE_KEY}_page_${page}`)
      return null
    }

    return data
  } catch {
    return null
  }
}

const setJobsCache = (page: number, jobs: Job[], totalPages: number) => {
  try {
    const data: JobsCache = {
      jobs,
      totalPages,
      page,
      timestamp: Date.now()
    }
    localStorage.setItem(`${JOBS_CACHE_KEY}_page_${page}`, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to cache jobs:', error)
  }
}

const clearJobsCache = () => {
  try {
    // Clear all job cache pages
    Object.keys(localStorage)
      .filter(key => key.startsWith(JOBS_CACHE_KEY))
      .forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear jobs cache:', error)
  }
}


// Entity cache helpers
const getEntitiesCache = (): EntitiesCache | null => {
  try {
    const cached = localStorage.getItem(ENTITIES_CACHE_KEY)
    if (!cached) return null
    return JSON.parse(cached)
  } catch {
    return null
  }
}

const updateEntityInCache = (entity: Entity) => {
  try {
    const cache = getEntitiesCache()
    if (!cache) {
      // Create new cache with this entity
      localStorage.setItem(ENTITIES_CACHE_KEY, JSON.stringify({
        entities: [entity],
        total_count: 1
      }))
      return
    }

    // Update or add entity
    const existingIndex = cache.entities.findIndex(e => e.id === entity.id)
    if (existingIndex >= 0) {
      cache.entities[existingIndex] = entity
    } else {
      cache.entities.push(entity)
      cache.total_count = cache.entities.length
    }

    localStorage.setItem(ENTITIES_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn('Failed to update entity cache:', error)
  }
}

const getEntityFromCache = (entityId: string): Entity | null => {
  const cache = getEntitiesCache()
  if (!cache) return null
  return cache.entities.find(e => e.id === entityId) || null
}

// Helper: Format date without timezone shift (fix -1 day bug)
const formatDateOnly = (dateString: string): string => {
  if (!dateString) return 'N/A'
  // Parse as local date (not UTC) to avoid timezone shift
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString()
}

export default function JobsPage() {
  const { user, loading: authLoading } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)


  const fetchJobs = async (currentPage = 1, showRefreshing = false, skipCache = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    // Check cache first (unless skipCache=true)
    if (!skipCache) {
      const cached = getJobsCache(currentPage)
      if (cached) {
        setJobs(cached.jobs)
        setTotalPages(cached.totalPages)
        setLoading(false)
        setRefreshing(false)
        // Still fetch in background to update cache
        fetchJobsFromAPI(currentPage, false)
        return
      }
    }

    await fetchJobsFromAPI(currentPage, showRefreshing)
  }

  const fetchJobsFromAPI = async (currentPage: number, showRefreshing: boolean) => {
    try {
      const response = await apiClient.listJobs(currentPage, 10)
      if (response && !response.error) {
        const data = response as any
        const jobsList = data.jobs || []

        // Collect all unique entity IDs
        const entityIds = Array.from(new Set(
          jobsList.map((job: any) => job.entity_id).filter(Boolean)
        )) as string[]

        // Check entities cache and fetch only missing or outdated ones
        await Promise.all(
          entityIds.map(async (entityId) => {
            const cachedEntity = getEntityFromCache(entityId)
            
            // Fetch if not in cache or if we want to refresh
            // (similar logic to /entities page)
            if (!cachedEntity) {
              try {
                const entityResponse = await apiClient.getEntity(entityId) as any
                if (entityResponse && !entityResponse.error && entityResponse.entity) {
                  const entity: Entity = {
                    id: entityResponse.entity.id,
                    display_name: entityResponse.entity.display_name,
                    identifier_suffix: entityResponse.entity.identifier?.slice(-4) || '',
                    entity_type: entityResponse.entity.type_code,
                    updated_at: entityResponse.entity.updated_at
                  }
                  updateEntityInCache(entity)
                }
              } catch (err) {
                console.warn(`Failed to fetch entity ${entityId}:`, err)
              }
            }
          })
        )

        // Map backend response to frontend Job interface
        // Entity data will be populated later from cache in useEffect
        const mappedJobs = jobsList.map((job: any) => ({
          id: job.job_id || job.id,
          job_name: job.job_name,
          status: job.status,
          entity_id: job.entity_id,  // Store entity_id for cache lookup
          entity_name: undefined,  // Will be populated from cache
          entity_nit: undefined,
          date_range: {
            start_date: job.start_date,
            end_date: job.end_date
          },
          docs_processed: job.processed_documents,
          docs_total: job.total_documents,
          created_at: job.created_at,
          completed_at: job.completed_at
        }))

        setJobs(mappedJobs)
        const total = data.total_count || 0
        const pageSize = data.per_page || 10
        const pages = Math.ceil(total / pageSize)
        setTotalPages(pages)

        // Cache the result
        setJobsCache(currentPage, mappedJobs, pages)
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
      toast.error('Error cargando jobs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    clearJobsCache()
    fetchJobs(page, true, true)
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
        // Use skipCache=true during polling to get fresh data
        fetchJobs(page, true, true)
      }, POLLING_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [jobs, page])

  // Populate entity data from cache whenever jobs change
  useEffect(() => {
    if (jobs.length === 0) return

    // Check if any job is missing entity data but has entity_id
    const needsEntityData = jobs.some(job => 
      job.entity_id && !job.entity_name
    )

    if (!needsEntityData) return

    const jobsWithEntities = jobs.map(job => {
      // Skip if already has entity data or no entity_id
      if (!job.entity_id || job.entity_name) return job

      const entity = getEntityFromCache(job.entity_id)
      if (!entity) return job

      return {
        ...job,
        entity_name: entity.display_name,
        entity_nit: entity.identifier_suffix ? `****${entity.identifier_suffix}` : undefined
      }
    })

    setJobs(jobsWithEntities)
  }, [jobs.length, jobs.filter(j => j.entity_id && !j.entity_name).length]) // Re-run when jobs change and have missing entity data

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
    const start = formatDateOnly(job.date_range.start_date)
    const end = formatDateOnly(job.date_range.end_date)
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
            onClick={handleRefresh}
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
                  {jobs.map((job) => {
                    const jobId = job.id;
                    const jobName = job.job_name;

                    return (
                    <TableRow key={jobId}>
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
                              <Link href={`/jobs/${jobId}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver detalles
                              </Link>
                            </DropdownMenuItem>
                            {job.status === 'completed' && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const result = await apiClient.downloadExcel(jobId)

                                    if (!result.success || !result.blob) {
                                      toast.error(result.error || 'Error descargando Excel')
                                      return
                                    }

                                    const url = window.URL.createObjectURL(result.blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = result.filename || `${jobName}.xlsx`
                                    document.body.appendChild(a)
                                    a.click()
                                    window.URL.revokeObjectURL(url)
                                    document.body.removeChild(a)
                                    toast.success('Excel descargado correctamente')
                                  } catch (error) {
                                    console.error('Error descargando Excel:', error)
                                    toast.error('Error al descargar el Excel')
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Descargar Excel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )})}
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
