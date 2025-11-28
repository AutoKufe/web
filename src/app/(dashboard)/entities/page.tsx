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
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
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
  Building2,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  MoreHorizontal,
  Mail
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Entity {
  id: string
  display_name: string
  identifier_suffix: string
  entity_type: string
  created_at: string
  dian_email?: {
    email_masked?: string
    status: 'active' | 'oauth_expired' | 'oauth_revoked' | 'inactive' | 'not_associated' | 'not_found' | 'error'
    message: string
    auth_failed_at?: string | null
  }
}

const getEntityTypeLabel = (type: string): string => {
  switch (type) {
    case 'juridica':
      return 'Persona Jurídica'
    case 'natural':
      return 'Persona Natural'
    default:
      return type
  }
}

const getDianEmailBadge = (status: string) => {
  switch (status) {
    case 'active':
      return { variant: 'default' as const, icon: '✅', label: 'Auto activa' }
    case 'oauth_expired':
      return { variant: 'destructive' as const, icon: '⚠️', label: 'OAuth expirado' }
    case 'oauth_revoked':
      return { variant: 'destructive' as const, icon: '❌', label: 'OAuth revocado' }
    case 'not_associated':
      return { variant: 'secondary' as const, icon: '📧', label: 'Sin email' }
    case 'not_found':
      return { variant: 'outline' as const, icon: '⚠️', label: 'Email no encontrado' }
    default:
      return { variant: 'outline' as const, icon: '❓', label: 'Desconocido' }
  }
}

export default function EntitiesPage() {
  const { user, loading: authLoading } = useAuth()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [registerToken, setRegisterToken] = useState('')
  const [registering, setRegistering] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchEntities = async (currentPage = 1) => {
    setLoading(true)
    try {
      const response = await apiClient.listEntities(currentPage, 10)
      if (response && !response.error) {
        const data = response as { entities?: Entity[]; total?: number; page_size?: number }
        setEntities(data.entities || [])
        const total = data.total || 0
        const pageSize = data.page_size || 10
        setTotalPages(Math.ceil(total / pageSize))
      }
    } catch (err) {
      console.error('Error fetching entities:', err)
      toast.error('Error cargando entidades')
    } finally {
      setLoading(false)
    }
  }

  const searchEntities = async () => {
    if (!searchQuery.trim()) {
      fetchEntities(1)
      return
    }

    setLoading(true)
    try {
      const response = await apiClient.searchEntities({
        name: searchQuery,
        page_size: 20,
      })
      if (response && !response.error) {
        const data = response as { entities?: Entity[] }
        setEntities(data.entities || [])
        setTotalPages(1)
      }
    } catch (err) {
      console.error('Error searching entities:', err)
      toast.error('Error buscando entidades')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterEntity = async () => {
    if (!registerToken.trim()) {
      toast.error('Ingresa el token DIAN')
      return
    }

    setRegistering(true)
    try {
      const response = await apiClient.registerEntity(registerToken)
      if (response.error) {
        toast.error(response.message || 'Error registrando entidad')
      } else {
        toast.success('Entidad registrada exitosamente')
        setRegisterDialogOpen(false)
        setRegisterToken('')
        fetchEntities(1)
      }
    } catch (err) {
      console.error('Error registering entity:', err)
      toast.error('Error registrando entidad')
    } finally {
      setRegistering(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    fetchEntities(page)
  }, [page, authLoading, user])

  const filteredEntities = entities

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entidades</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus entidades registradas
          </p>
        </div>
        <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar Entidad
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nueva Entidad</DialogTitle>
              <DialogDescription>
                Ingresa el token DIAN para registrar una nueva empresa.
                Puedes obtenerlo desde el portal de la DIAN.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dian-token">Token DIAN (URL)</Label>
                <Input
                  id="dian-token"
                  placeholder="https://catalogo-vpfe.dian.gov.co/..."
                  value={registerToken}
                  onChange={(e) => setRegisterToken(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Pega la URL completa del token que obtuviste de la DIAN
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRegisterDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRegisterEntity}
                disabled={registering || !registerToken.trim()}
              >
                {registering ? 'Registrando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o NIT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchEntities()}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => searchEntities()}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                fetchEntities(1)
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entities Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Entidades Registradas</CardTitle>
          <CardDescription>
            {entities.length} entidad{entities.length !== 1 ? 'es' : ''} encontrada{entities.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-3 px-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted/50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No se encontraron entidades' : 'No tienes entidades registradas'}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                {searchQuery
                  ? 'Intenta con otro término de búsqueda'
                  : 'Registra tu primera entidad para comenzar a procesar documentos DIAN'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setRegisterDialogOpen(true)} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar primera entidad
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="pl-6">Nombre</TableHead>
                    <TableHead>Identificador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Gestión Automática</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead className="w-[70px] pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntities.map((entity) => {
                    const dianEmail = entity.dian_email
                    const badgeInfo = dianEmail ? getDianEmailBadge(dianEmail.status) : null

                    return (
                      <TableRow key={entity.id} className="hover:bg-muted/50">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{entity.display_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          ****{entity.identifier_suffix}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {getEntityTypeLabel(entity.entity_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {badgeInfo ? (
                            <div className="space-y-1">
                              <Badge variant={badgeInfo.variant} className="font-normal">
                                {badgeInfo.icon} {badgeInfo.label}
                              </Badge>
                              {dianEmail?.email_masked && dianEmail.status === 'active' && (
                                <p className="text-xs text-muted-foreground">
                                  {dianEmail.email_masked}
                                </p>
                              )}
                              {(dianEmail?.status === 'oauth_expired' || dianEmail?.status === 'oauth_revoked') && dianEmail.email_masked && (
                                <p className="text-xs text-muted-foreground">
                                  {dianEmail.email_masked}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="font-normal">
                              📧 Sin email
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(entity.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/entities/${entity.id}`} className="cursor-pointer">
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Ver detalles
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/jobs/new?entity=${entity.id}`} className="cursor-pointer">
                                  <Plus className="h-4 w-4 mr-2" />
                                  Crear job
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 pb-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
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

      {/* Educational Section - How to associate DIAN email */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            ¿Cómo asociar un email DIAN a tu entidad?
          </CardTitle>
          <CardDescription>
            Habilita la gestión automática de tokens para tus entidades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Autoriza tu email DIAN</p>
                <p className="text-muted-foreground text-xs">
                  Ve a <strong>Configuración → Emails DIAN</strong> y autoriza el email donde recibes los tokens
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Solicita un token manual para esta entidad</p>
                <p className="text-muted-foreground text-xs">
                  Crea un job manual (solicitando token tú mismo desde la DIAN)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">¡Listo! La asociación es automática</p>
                <p className="text-muted-foreground text-xs">
                  Cuando llegue el token, el sistema detectará automáticamente qué email DIAN corresponde a esta entidad
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold shrink-0 mt-0.5">
                ✓
              </div>
              <div>
                <p className="font-medium text-green-600">Próximos jobs usarán gestión automática</p>
                <p className="text-muted-foreground text-xs">
                  Ya no necesitarás solicitar tokens manualmente - el sistema lo hará por ti
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Importante:</strong> Si cambias el email de la DIAN donde recibes los tokens,
              simplemente solicita un nuevo token manual y el sistema actualizará la asociación automáticamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
