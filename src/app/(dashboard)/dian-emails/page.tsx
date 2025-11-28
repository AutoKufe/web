'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Mail,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  Power,
  Loader2,
  Info
} from 'lucide-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { toast } from 'sonner'

interface DianEmail {
  dian_email_id: string
  email: string
  status: string
  requested_at: string
  authorized_at?: string
  deactivated_at?: string
  has_filter: boolean
  has_associated_entities?: boolean
  associated_entities_count?: number
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
    active: { variant: 'default', label: 'Activo', icon: <CheckCircle2 className="h-3 w-3" /> },
    pending: { variant: 'secondary', label: 'Pendiente OAuth', icon: <Clock className="h-3 w-3" /> },
    inactive: { variant: 'outline', label: 'Inactivo', icon: <Power className="h-3 w-3" /> },
    revoked: { variant: 'destructive', label: 'Revocado', icon: <XCircle className="h-3 w-3" /> },
    expired: { variant: 'destructive', label: 'Expirado', icon: <AlertCircle className="h-3 w-3" /> },
    failed: { variant: 'destructive', label: 'Fallido', icon: <XCircle className="h-3 w-3" /> },
  }
  const { variant, label, icon } = config[status] || { variant: 'outline' as const, label: status, icon: null }
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  )
}

export default function DianEmailsPage() {
  const { user, loading: authLoading } = useAuth()
  const [dianEmails, setDianEmails] = useState<DianEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [registerEmail, setRegisterEmail] = useState('')
  const [registering, setRegistering] = useState(false)

  const fetchDianEmails = async () => {
    setLoading(true)
    try {
      const response = await apiClient.listDianEmails()
      if (response && 'success' in response && response.success && 'dian_emails' in response) {
        setDianEmails(response.dian_emails as DianEmail[])
      }
    } catch (err) {
      console.error('Error fetching DIAN emails:', err)
      toast.error('Error cargando DIAN emails')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    fetchDianEmails()
  }, [authLoading, user])

  const handleRegister = async () => {
    if (!registerEmail.trim()) {
      toast.error('Ingresa un email DIAN válido')
      return
    }

    setRegistering(true)
    try {
      const response = await apiClient.registerDianEmail(registerEmail) as any
      if (response.error) {
        toast.error(response.message || 'Error registrando DIAN email')
        return
      }

      toast.success('DIAN email registrado')

      // Abrir OAuth URL en nueva ventana
      if (response.oauth_url) {
        window.open(response.oauth_url, '_blank')
        toast.info('Completa la autorización OAuth en la nueva ventana')
      }

      setRegisterDialogOpen(false)
      setRegisterEmail('')
      fetchDianEmails()
    } catch (err) {
      console.error('Error registering DIAN email:', err)
      toast.error('Error registrando DIAN email')
    } finally {
      setRegistering(false)
    }
  }

  const handleRegenerateOAuth = async (dianEmailId: string) => {
    try {
      const response = await apiClient.regenerateOAuthUrl(dianEmailId) as any
      if (response.error) {
        toast.error(response.message || 'Error regenerando OAuth URL')
        return
      }

      toast.success('OAuth URL regenerada')

      if (response.oauth_url) {
        window.open(response.oauth_url, '_blank')
        toast.info('Completa la autorización OAuth en la nueva ventana')
      }
    } catch (err) {
      console.error('Error regenerating OAuth:', err)
      toast.error('Error regenerando OAuth URL')
    }
  }

  const handleDeactivate = async (dianEmailId: string) => {
    try {
      const response = await apiClient.deactivateDianEmail(dianEmailId) as any
      if (response.error) {
        toast.error(response.message || 'Error desactivando DIAN email')
        return
      }

      toast.success('DIAN email desactivado')
      fetchDianEmails()
    } catch (err) {
      console.error('Error deactivating:', err)
      toast.error('Error desactivando DIAN email')
    }
  }

  const handleReactivate = async (dianEmailId: string) => {
    try {
      const response = await apiClient.reactivateDianEmail(dianEmailId) as any
      if (response.error) {
        toast.error(response.message || 'Error reactivando DIAN email')
        return
      }

      toast.success('DIAN email reactivado')
      fetchDianEmails()
    } catch (err) {
      console.error('Error reactivating:', err)
      toast.error('Error reactivando DIAN email')
    }
  }

  if (loading && authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">DIAN Emails</h1>
        <p className="text-muted-foreground">
          Gestiona los emails DIAN para recibir tokens automáticamente
        </p>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Register Button */}
          <div className="flex justify-end">
            <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Email DIAN
                </Button>
              </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Email DIAN</DialogTitle>
              <DialogDescription>
                Ingresa el email donde recibes los tokens DIAN de tus entidades
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dian-email">Email DIAN</Label>
                <Input
                  id="dian-email"
                  type="email"
                  placeholder="ejemplo@empresa.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  disabled={registering}
                />
                <p className="text-xs text-muted-foreground">
                  Este es el email configurado en tu cuenta DIAN donde llegan los tokens
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRegisterDialogOpen(false)}
                disabled={registering}
              >
                Cancelar
              </Button>
              <Button onClick={handleRegister} disabled={registering}>
                {registering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Registrar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </div>

          {/* Contextual Alert - Active emails without entities */}
          {dianEmails.some(email =>
            email.status === 'active' &&
            !email.has_associated_entities
          ) && (
            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900 text-sm">¡Siguiente paso pendiente!</AlertTitle>
              <AlertDescription className="text-xs text-amber-800">
                <p className="mb-2">
                  Tienes {dianEmails.filter(e => e.status === 'active' && !e.has_associated_entities).length} email(s) DIAN autorizado(s) pero <strong>sin entidades asociadas</strong>.
                </p>
                <Link href="/entities">
                  <Button size="sm" variant="outline" className="bg-white text-xs h-8">
                    <Plus className="h-3 w-3 mr-1" />
                    Registrar Entidades
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* DIAN Emails List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tus DIAN Emails</CardTitle>
              <CardDescription>
                {dianEmails.length} email{dianEmails.length !== 1 ? 's' : ''} registrado{dianEmails.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchDianEmails}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dianEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No tienes DIAN emails registrados</h3>
              <p className="text-muted-foreground mb-4">
                Registra tu primer email DIAN para habilitar la gestión automática de tokens
              </p>
              <Button onClick={() => setRegisterDialogOpen(true)}>
                Registrar Email DIAN
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Entidades Asociadas</TableHead>
                  <TableHead>Filtro Gmail</TableHead>
                  <TableHead>Registrado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dianEmails.map((dianEmail) => (
                  <TableRow key={dianEmail.dian_email_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{dianEmail.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(dianEmail.status)}
                    </TableCell>
                    <TableCell>
                      {dianEmail.has_associated_entities ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {dianEmail.associated_entities_count} entidad{dianEmail.associated_entities_count !== 1 ? 'es' : ''}
                        </Badge>
                      ) : dianEmail.status === 'active' ? (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                          <AlertCircle className="h-3 w-3" />
                          Sin asociar
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" />
                          Sin asociar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {dianEmail.has_filter ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" />
                          Sin configurar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(dianEmail.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {dianEmail.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerateOAuth(dianEmail.dian_email_id)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Autorizar
                          </Button>
                        )}
                        {dianEmail.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(dianEmail.dian_email_id)}
                          >
                            Desactivar
                          </Button>
                        )}
                        {dianEmail.status === 'inactive' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivate(dianEmail.dian_email_id)}
                          >
                            Reactivar
                          </Button>
                        )}
                        {(dianEmail.status === 'revoked' || dianEmail.status === 'expired' || dianEmail.status === 'failed') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerateOAuth(dianEmail.dian_email_id)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Re-autorizar
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

        {/* Right Column - Educational Content (1/3 width) */}
        <div className="space-y-4">
          {/* How it Works Card */}
          <Card className="border-blue-200 bg-blue-50/30 sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                ¿Cómo funciona?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Registra y autoriza aquí</p>
                    <p className="text-muted-foreground">
                      Email donde recibes tokens DIAN
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Registra entidades</p>
                    <p className="text-muted-foreground">
                      Ve a <Link href="/entities" className="underline">Entidades</Link>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Solicita token DIAN</p>
                    <p className="text-muted-foreground">
                      Desde <strong>catalogo-vpfe.dian.gov.co</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <p className="font-medium text-green-600">¡Automático!</p>
                    <p className="text-muted-foreground">
                      AutoKufe gestiona tokens por ti
                    </p>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200 py-2">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <AlertDescription className="text-[10px] text-amber-900 ml-5">
                  <strong>Importante:</strong> La asociación es automática cuando llega el token al email.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
