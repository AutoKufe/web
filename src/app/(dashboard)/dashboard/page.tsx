'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  FileText,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Info
} from 'lucide-react'

interface UsageData {
  docs_used: number
  docs_limit: number
  plan: string
  period_end: string
}

interface RecentJob {
  id: string
  job_name: string
  status: string
  created_at: string
  entity_name?: string
}

interface EntitySummary {
  total: number
  recent: Array<{
    id: string
    display_name: string
    identifier_suffix: string
  }>
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [entities, setEntities] = useState<EntitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return

    const fetchData = async () => {
      try {
        const [usageRes, jobsRes, entitiesRes] = await Promise.all([
          apiClient.getUsage(),
          apiClient.listJobs(1, 5),
          apiClient.listEntities(1, 5),
        ])

        if (usageRes && !usageRes.error) {
          setUsage(usageRes as unknown as UsageData)
        }

        if (jobsRes && !jobsRes.error) {
          const jobsData = jobsRes as { jobs?: any[] }
          const jobsList = jobsData.jobs || []

          // Fetch entity names for each job
          const mappedJobs = await Promise.all(jobsList.map(async (job: any) => {
            let entityName = undefined

            if (job.entity_id) {
              try {
                const entityResponse = await apiClient.getEntity(job.entity_id) as any
                if (entityResponse && !entityResponse.error && entityResponse.entity) {
                  entityName = entityResponse.entity.name
                }
              } catch {
                // Silently fail
              }
            }

            return {
              id: job.job_id || job.id,
              job_name: job.job_name,
              status: job.status,
              created_at: job.created_at,
              entity_name: entityName
            }
          }))

          setRecentJobs(mappedJobs)
        }

        if (entitiesRes && !entitiesRes.error) {
          const entitiesData = entitiesRes as {
            entities?: Array<{ id: string; display_name: string; identifier_suffix: string }>
            pagination?: { total_count?: number }
          }
          setEntities({
            total: entitiesData.pagination?.total_count || 0,
            recent: entitiesData.entities || [],
          })
        }
      } catch (err) {
        setError('Error cargando datos del dashboard')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authLoading, user])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'processing':
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

  const usagePercentage = usage ? Math.round((usage.docs_used / usage.docs_limit) * 100) : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de tu actividad en AutoKufe
          </p>
        </div>
        <Link href="/jobs/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Job
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Usage Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Uso mensual
              </CardTitle>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                  <p className="font-semibold mb-1">¿Qué cuenta como uso?</p>
                  <p>Solo los documentos que descargamos de la DIAN cuentan para tu límite mensual. Procesar o regenerar reportes no consume límite adicional.</p>
                </div>
              </div>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">
              {usage?.docs_used?.toLocaleString() || 0}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}/ {usage?.docs_limit?.toLocaleString() || 0}
              </span>
            </div>
            <div className="mt-2">
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usagePercentage >= 90
                      ? 'bg-destructive'
                      : usagePercentage >= 70
                      ? 'bg-yellow-500'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {usagePercentage}% usado • Plan {usage?.plan || 'free'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Entities Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">
              Entidades registradas
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{entities?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {entities?.recent?.length
                ? `${entities.recent.length} más ${entities.recent.length === 1 ? 'reciente' : 'recientes'}`
                : 'Sin entidades'}
            </p>
            <Link href="/entities">
              <Button variant="link" className="px-0 h-auto text-xs">
                Ver todas <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Jobs Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">
              Jobs recientes
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{recentJobs.length}</div>
            <p className="text-xs text-muted-foreground">
              {recentJobs.filter(j => j.status === 'completed').length} completados
            </p>
            <Link href="/jobs">
              <Button variant="link" className="px-0 h-auto text-xs">
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jobs Recientes</CardTitle>
              <CardDescription>
                Tus últimos trabajos de procesamiento
              </CardDescription>
            </div>
            <Link href="/jobs">
              <Button variant="outline" size="sm">
                Ver todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
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
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.job_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.entity_name || 'Entidad'} • {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status)}
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="sm">
                        Ver
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Entities */}
      {entities && entities.recent.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Entidades Recientes</CardTitle>
                <CardDescription>
                  Tus entidades registradas
                </CardDescription>
              </div>
              <Link href="/entities">
                <Button variant="outline" size="sm">
                  Ver todas
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {entities.recent.map((entity) => (
                <Link key={entity.id} href={`/entities/${entity.id}`}>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{entity.display_name}</p>
                        {entity.identifier_suffix && (
                          <p className="text-sm text-muted-foreground font-mono">
                            Identificador: ****{entity.identifier_suffix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
