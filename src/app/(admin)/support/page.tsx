'use client'

import { useEffect, useState } from 'react'
import { useUserRoles } from '@/lib/hooks/use-user-roles'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { canResolveJobs } from '@/lib/auth/roles'

interface JobWithError {
  id: string
  job_name: string
  status: string
  technical_review_status: string
  error_category?: string
  reported_error_at?: string
  user_email?: string
  created_at: string
}

export default function SupportQueuePage() {
  const { roles, loading: rolesLoading } = useUserRoles()
  const [jobs, setJobs] = useState<JobWithError[]>([])
  const [loading, setLoading] = useState(true)
  const canResolve = canResolveJobs(roles)

  useEffect(() => {
    if (rolesLoading) return
    fetchErrorJobs()
  }, [rolesLoading])

  const fetchErrorJobs = async () => {
    setLoading(true)
    try {
      // TODO: Implement backend endpoint for admin job listing with filters
      const response = await apiClient.listJobs(1, 50)
      if (response && !response.error) {
        const data = response as any
        const jobsList = data.jobs || []

        // Filter jobs with errors or pending review
        const errorJobs = jobsList.filter((job: any) =>
          job.status === 'failed' ||
          job.technical_review_status === 'pending_review' ||
          job.technical_review_status === 'under_review'
        )

        setJobs(errorJobs)
      }
    } catch (err) {
      console.error('Error fetching error jobs:', err)
      toast.error('Error cargando jobs con errores')
    } finally {
      setLoading(false)
    }
  }

  const getReviewStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
      pending_review: {
        variant: 'destructive',
        label: 'Pendiente',
        icon: <AlertCircle className="h-3 w-3" />
      },
      under_review: {
        variant: 'secondary',
        label: 'En Revisión',
        icon: <Clock className="h-3 w-3" />
      },
      resolved: {
        variant: 'default',
        label: 'Resuelto',
        icon: <CheckCircle2 className="h-3 w-3" />
      },
      wont_fix: {
        variant: 'outline',
        label: 'No se Arreglará',
        icon: <XCircle className="h-3 w-3" />
      },
    }
    const { variant, label, icon } = config[status] || { variant: 'outline' as const, label: status, icon: null }
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {icon}
        {label}
      </Badge>
    )
  }

  if (rolesLoading || loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cola de Soporte</h1>
        <p className="text-gray-600 mt-2">
          Jobs con errores reportados y pendientes de revisión técnica
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs con Errores</CardTitle>
          <CardDescription>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} requiriendo atención
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-gray-600">No hay jobs pendientes de revisión</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Revisión</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Reportado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.job_name}</TableCell>
                    <TableCell>{job.user_email || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getReviewStatusBadge(job.technical_review_status)}
                    </TableCell>
                    <TableCell>
                      {job.error_category ? (
                        <Badge variant="outline">{job.error_category}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {job.reported_error_at
                        ? new Date(job.reported_error_at).toLocaleDateString()
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.location.href = `/jobs/${job.id}`
                          }}
                        >
                          Ver
                        </Button>
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              toast.info('Funcionalidad de resolución próximamente')
                            }}
                          >
                            Resolver
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
