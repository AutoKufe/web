'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  Mail,
  Trash2,
  Loader2
} from 'lucide-react'
import { useUserRoles } from '@/lib/hooks/use-user-roles'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useEntities,
  useDianEmails,
  useRegisterEntity,
  useRegisterEntityManual,
  useCleanupEntityStorage,
  type Entity,
  type DianEmail,
  type ManualEntityData,
} from '@/lib/query'
import { EntityTableSkeleton } from '@/components/skeletons'

const PAGE_SIZE = 10

const getEntityTypeLabel = (type: string): string => {
  switch (type) {
    case 'juridica':
      return 'Persona Juridica'
    case 'natural':
      return 'Persona Natural'
    default:
      return type
  }
}

const getDianEmailBadge = (status: string) => {
  switch (status) {
    case 'active':
      return { variant: 'default' as const, icon: '', label: 'Auto activa' }
    case 'pending':
      return { variant: 'secondary' as const, icon: '', label: 'Pendiente' }
    case 'expired':
    case 'oauth_expired':
      return { variant: 'destructive' as const, icon: '', label: 'OAuth expirado' }
    case 'revoked':
    case 'oauth_revoked':
      return { variant: 'destructive' as const, icon: '', label: 'OAuth revocado' }
    case 'inactive':
      return { variant: 'secondary' as const, icon: '', label: 'Inactivo' }
    case 'failed':
      return { variant: 'destructive' as const, icon: '', label: 'Fallo' }
    default:
      return { variant: 'outline' as const, icon: '', label: 'Desconocido' }
  }
}

export default function EntitiesPage() {
  const router = useRouter()

  // React Query hooks
  const { data: entitiesData, isLoading, refetch, isFetching } = useEntities()
  const { data: dianEmailsData } = useDianEmails()
  const registerMutation = useRegisterEntity()
  const registerManualMutation = useRegisterEntityManual()
  const cleanupMutation = useCleanupEntityStorage()

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [registerMode, setRegisterMode] = useState<'manual' | 'token'>('manual')
  const [registerToken, setRegisterToken] = useState('')
  const [page, setPage] = useState(1)

  // Manual registration form state
  const [manualForm, setManualForm] = useState({
    entity_type: 'natural' as 'natural' | 'juridica',
    document_type: 'CC',
    document_number: '',
    company_nit: '',
  })

  // Dev mode state
  const { isDev: hasDevRole } = useUserRoles()
  const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging'

  // Cleanup storage dialog state
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false)
  const [cleanupEntity, setCleanupEntity] = useState<Entity | null>(null)

  // Build email lookup map
  const dianEmailsMap = useMemo(() => {
    const map = new Map<string, DianEmail>()
    dianEmailsData?.emails?.forEach((email) => {
      map.set(email.id, email)
    })
    return map
  }, [dianEmailsData?.emails])

  // Filter and paginate entities
  const { filteredEntities, paginatedEntities, totalPages, totalCount } = useMemo(() => {
    const entities = entitiesData?.entities || []

    // Filter by search query
    let filtered = entities
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = entities.filter(
        (e) =>
          e.display_name.toLowerCase().includes(query) ||
          e.identifier_suffix.includes(query)
      )
    }

    // Sort by created_at DESC
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Paginate
    const start = (page - 1) * PAGE_SIZE
    const paginated = sorted.slice(start, start + PAGE_SIZE)

    return {
      filteredEntities: sorted,
      paginatedEntities: paginated,
      totalPages: Math.ceil(sorted.length / PAGE_SIZE),
      totalCount: sorted.length,
    }
  }, [entitiesData?.entities, searchQuery, page])

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  const resetRegisterDialog = useCallback(() => {
    setRegisterMode('manual')
    setRegisterToken('')
    setManualForm({
      entity_type: 'natural',
      document_type: 'CC',
      document_number: '',
      company_nit: '',
    })
  }, [])

  const handleRegisterEntity = async () => {
    if (!registerToken.trim()) {
      toast.error('Ingresa el token DIAN')
      return
    }

    try {
      const result = await registerMutation.mutateAsync(registerToken)
      if (result.status === 'duplicate_token_updated') {
        toast.success(result.message || 'Entidad ya existe. Token DIAN actualizado.')
      } else {
        toast.success('Entidad registrada exitosamente')
      }
      setRegisterDialogOpen(false)
      resetRegisterDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error registrando entidad')
    }
  }

  const handleRegisterManual = async () => {
    if (!manualForm.document_number.trim()) {
      toast.error('Ingresa el numero de documento')
      return
    }
    if (manualForm.entity_type === 'juridica' && !manualForm.company_nit?.trim()) {
      toast.error('Ingresa el NIT de la empresa')
      return
    }

    try {
      const data: ManualEntityData = {
        entity_type: manualForm.entity_type,
        document_type: manualForm.document_type,
        document_number: manualForm.document_number,
      }
      if (manualForm.entity_type === 'juridica') {
        data.company_nit = manualForm.company_nit
      }

      await registerManualMutation.mutateAsync(data)
      toast.success('Entidad registrada exitosamente')
      setRegisterDialogOpen(false)
      resetRegisterDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error registrando entidad')
    }
  }

  const handleCleanupStorage = async () => {
    if (!cleanupEntity) return

    try {
      const result = await cleanupMutation.mutateAsync(cleanupEntity.id)
      toast.success(
        `Storage limpiado: ${result.files_deleted} archivos eliminados (${result.space_freed_mb}MB liberados)`
      )
      setCleanupDialogOpen(false)
      setCleanupEntity(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error limpiando storage')
    }
  }

  const openCleanupDialog = (entity: Entity) => {
    setCleanupEntity(entity)
    setCleanupDialogOpen(true)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Entidades</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona tus entidades registradas
        </p>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column - Main Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Register Button */}
          <div className="flex justify-end gap-2">
            <Dialog open={registerDialogOpen} onOpenChange={(open) => {
              setRegisterDialogOpen(open)
              if (!open) resetRegisterDialog()
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Entidad
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Registrar Nueva Entidad</DialogTitle>
                  <DialogDescription>
                    {registerMode === 'manual'
                      ? 'Ingresa los datos de la entidad. El token DIAN se proporcionara al crear un job.'
                      : 'Ingresa el token DIAN para registrar automaticamente.'}
                  </DialogDescription>
                </DialogHeader>

                {registerMode === 'manual' ? (
                  <>
                    <div className="space-y-4 py-2">
                      {/* Entity Type */}
                      <div className="space-y-2">
                        <Label>Tipo de persona</Label>
                        <Select
                          value={manualForm.entity_type}
                          onValueChange={(v) =>
                            setManualForm((prev) => ({
                              ...prev,
                              entity_type: v as 'natural' | 'juridica',
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="natural">Persona Natural</SelectItem>
                            <SelectItem value="juridica">Persona Juridica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Juridica: NIT */}
                      {manualForm.entity_type === 'juridica' && (
                        <div className="space-y-2">
                          <Label htmlFor="company-nit">NIT de la empresa</Label>
                          <Input
                            id="company-nit"
                            placeholder="900123456"
                            value={manualForm.company_nit}
                            onChange={(e) =>
                              setManualForm((prev) => ({ ...prev, company_nit: e.target.value }))
                            }
                          />
                        </div>
                      )}

                      {/* Document type + number */}
                      <div className="grid grid-cols-[140px_1fr] gap-3">
                        <div className="space-y-2">
                          <Label>
                            {manualForm.entity_type === 'juridica' ? 'Tipo doc. RL' : 'Tipo doc.'}
                          </Label>
                          <Select
                            value={manualForm.document_type}
                            onValueChange={(v) =>
                              setManualForm((prev) => ({ ...prev, document_type: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CC">CC</SelectItem>
                              <SelectItem value="CE">CE</SelectItem>
                              <SelectItem value="PA">Pasaporte</SelectItem>
                              <SelectItem value="TI">TI</SelectItem>
                              <SelectItem value="PEP">PEP</SelectItem>
                              <SelectItem value="PPT">PPT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="doc-number">
                            {manualForm.entity_type === 'juridica' ? 'Numero doc. RL' : 'Numero'}
                          </Label>
                          <Input
                            id="doc-number"
                            placeholder="1234567890"
                            value={manualForm.document_number}
                            onChange={(e) =>
                              setManualForm((prev) => ({ ...prev, document_number: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        El nombre y razon social se completaran automaticamente al usar un token DIAN.
                      </p>
                    </div>

                    <DialogFooter className="flex-col gap-3 sm:flex-col">
                      <div className="flex gap-2 w-full justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRegisterDialogOpen(false)
                            resetRegisterDialog()
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleRegisterManual}
                          disabled={registerManualMutation.isPending}
                        >
                          {registerManualMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Registrando...
                            </>
                          ) : (
                            'Registrar'
                          )}
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                        onClick={() => setRegisterMode('token')}
                      >
                        Registrar con token DIAN
                      </button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <div className="space-y-4 py-2">
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
                    <DialogFooter className="flex-col gap-3 sm:flex-col">
                      <div className="flex gap-2 w-full justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRegisterDialogOpen(false)
                            resetRegisterDialog()
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleRegisterEntity}
                          disabled={registerMutation.isPending || !registerToken.trim()}
                        >
                          {registerMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Registrando...
                            </>
                          ) : (
                            'Registrar'
                          )}
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                        onClick={() => setRegisterMode('manual')}
                      >
                        Registrar manualmente
                      </button>
                    </DialogFooter>
                  </>
                )}
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
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Entities Table */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Entidades Registradas</CardTitle>
              <CardDescription>
                {totalCount} entidad{totalCount !== 1 ? 'es' : ''} encontrada{totalCount !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 overflow-hidden">
              {isLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="pl-6">Nombre</TableHead>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Gestion Automatica</TableHead>
                      <TableHead>Registrado</TableHead>
                      <TableHead className="w-[70px] pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <EntityTableSkeleton rows={3} />
                  </TableBody>
                </Table>
              ) : paginatedEntities.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? 'No se encontraron entidades' : 'No tienes entidades registradas'}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                    {searchQuery
                      ? 'Intenta con otro termino de busqueda'
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
                        <TableHead>Gestion Automatica</TableHead>
                        <TableHead>Registrado</TableHead>
                        <TableHead className="w-[70px] pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntities.map((entity) => {
                        // Lookup dian_email from cache
                        const dianEmail = entity.dian_email_id
                          ? dianEmailsMap.get(entity.dian_email_id)
                          : null
                        const badgeInfo = dianEmail
                          ? getDianEmailBadge(dianEmail.auth_status)
                          : null

                        return (
                          <TableRow
                            key={entity.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/entidades/${entity.id}`)}
                          >
                            <TableCell className="pl-6 max-w-[290px]">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                                  <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-medium truncate" title={entity.display_name}>
                                  {entity.display_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              ****{entity.identifier_suffix}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {getEntityTypeLabel(entity.type_code)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {badgeInfo ? (
                                <div className="space-y-1">
                                  <Badge variant={badgeInfo.variant} className="font-normal">
                                    {badgeInfo.label}
                                  </Badge>
                                  {dianEmail?.email_masked &&
                                    dianEmail.auth_status === 'active' && (
                                      <p className="text-xs text-muted-foreground">
                                        {dianEmail.email_masked}
                                      </p>
                                    )}
                                  {(dianEmail?.auth_status === 'expired' ||
                                    dianEmail?.auth_status === 'revoked') &&
                                    dianEmail.email_masked && (
                                      <p className="text-xs text-muted-foreground">
                                        {dianEmail.email_masked}
                                      </p>
                                    )}
                                </div>
                              ) : (
                                <Badge variant="secondary" className="font-normal">
                                  Sin email
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(entity.created_at).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/entidades/${entity.id}`}
                                      className="cursor-pointer"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Ver detalles
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/trabajos/nuevo?entity=${entity.id}`}
                                      className="cursor-pointer"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Crear job
                                    </Link>
                                  </DropdownMenuItem>
                                  {isStaging && hasDevRole && (
                                    <DropdownMenuItem
                                      className="text-red-600 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openCleanupDialog(entity)
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Limpiar storage
                                    </DropdownMenuItem>
                                  )}
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

        {/* Right Column - Educational Content (1/3 width) */}
        <div className="space-y-2">
          {/* How to associate DIAN email */}
          <Card className="border-blue-200 bg-blue-50/30 sticky top-4">
            <CardHeader className="pb-1.5 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                Gestion Automatica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2 pb-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Autoriza tu email DIAN</p>
                    <p className="text-muted-foreground text-[10px]">
                      Ve a <Link href="/dian-emails" className="underline">Emails DIAN</Link> y autoriza el email donde recibes tokens.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Solicita token DIAN</p>
                    <p className="text-muted-foreground text-[10px]">
                      Desde <strong>catalogo-vpfe.dian.gov.co</strong> solicita un token para esta entidad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Asociacion automatica</p>
                    <p className="text-muted-foreground text-[10px]">
                      Cuando llegue el token, el sistema detectara automaticamente que email corresponde a esta entidad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    ok
                  </div>
                  <div>
                    <p className="font-medium text-green-600">Jobs sin tokens manuales</p>
                    <p className="text-muted-foreground text-[10px]">
                      Ya no necesitaras solicitar tokens manualmente - el sistema lo hara por ti.
                    </p>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200 py-1.5">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <AlertDescription className="text-[10px] text-amber-900 ml-5">
                  <strong>Importante:</strong> Si cambias el email DIAN, solicita un nuevo token y el sistema actualizara la asociacion automaticamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cleanup Storage Confirmation Dialog */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Limpiar Storage
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                <p>
                  Se eliminaran <strong>TODOS</strong> los archivos de storage para{' '}
                  <strong className="text-foreground">{cleanupEntity?.display_name}</strong>:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ZIPs de documentos descargados</li>
                  <li>Excel generados</li>
                  <li>Raw Excel cacheados</li>
                  <li>Logs de jobs</li>
                </ul>
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm ml-2">
                    <strong>NO</strong> se eliminara la entidad ni el historial de jobs.
                    Solo los archivos en storage.
                  </AlertDescription>
                </Alert>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setCleanupDialogOpen(false)
                setCleanupEntity(null)
              }}
              disabled={cleanupMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCleanupStorage}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Confirmar eliminacion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
