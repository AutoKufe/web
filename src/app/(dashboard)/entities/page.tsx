'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { useDianEmailsCache } from '@/lib/hooks/use-dian-emails-cache'
import { getDianEmailFromCache } from '@/lib/cache/dian-emails-cache'

interface Entity {
  id: string
  display_name: string
  identifier_suffix: string
  entity_type: string
  created_at: string
  updated_at?: string  // Timestamp de última actualización en DB
  dian_email_id?: string | null  // Reference to dian_email - lookup in cache
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
    case 'pending':
      return { variant: 'secondary' as const, icon: '⏳', label: 'Pendiente' }
    case 'expired':
    case 'oauth_expired':
      return { variant: 'destructive' as const, icon: '⚠️', label: 'OAuth expirado' }
    case 'revoked':
    case 'oauth_revoked':
      return { variant: 'destructive' as const, icon: '❌', label: 'OAuth revocado' }
    case 'inactive':
      return { variant: 'secondary' as const, icon: '⭕', label: 'Inactivo' }
    case 'failed':
      return { variant: 'destructive' as const, icon: '❗', label: 'Falló' }
    default:
      return { variant: 'outline' as const, icon: '❓', label: 'Desconocido' }
  }
}

const ENTITIES_CACHE_KEY = 'autokufe_entities_cache_global'

interface EntitiesCache {
  entities: Entity[]  // Cada entity tiene su propio updated_at
  total_count: number
}

interface EntityMap {
  [id: string]: Entity
}

export default function EntitiesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [registerToken, setRegisterToken] = useState('')
  const [registering, setRegistering] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const fetchingRef = useRef(false)  // Prevenir llamadas duplicadas
  const { syncDianEmails } = useDianEmailsCache()

  const loadFromCache = (): EntitiesCache | null => {
    try {
      const cached = localStorage.getItem(ENTITIES_CACHE_KEY)
      if (!cached) return null

      const data: EntitiesCache = JSON.parse(cached)
      return data
    } catch (err) {
      console.error('Error loading cache:', err)
      return null
    }
  }

  const saveToCache = (entities: Entity[], total_count: number) => {
    try {
      // Guardar entidades con sus updated_at individuales preservados
      const cache: EntitiesCache = {
        entities,
        total_count
      }
      localStorage.setItem(ENTITIES_CACHE_KEY, JSON.stringify(cache))
    } catch (err) {
      console.error('Error saving cache:', err)
    }
  }

  const getEntitiesForPage = (allEntities: Entity[], pageNum: number, pageSize: number = 10): Entity[] => {
    // Sort by created_at DESC (más recientes primero)
    const sorted = [...allEntities].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const start = (pageNum - 1) * pageSize
    const end = start + pageSize
    return sorted.slice(start, end)
  }

  const applyIncrementalChanges = (
    cachedEntities: Entity[],
    changes: Entity[],
    deletedIds: string[]
  ): Entity[] => {
    const entityMap: EntityMap = {}

    // Agregar entities del cache
    cachedEntities.forEach(entity => {
      entityMap[entity.id] = entity
    })

    // Aplicar cambios (modificaciones y adiciones)
    changes.forEach(entity => {
      entityMap[entity.id] = entity
    })

    // Eliminar entities borradas
    deletedIds.forEach(id => {
      delete entityMap[id]
    })

    return Object.values(entityMap)
  }

  const fetchEntities = async (currentPage = 1, forceFullSync = false) => {
    // Prevenir llamadas duplicadas concurrentes
    if (fetchingRef.current) {
      return
    }

    fetchingRef.current = true

    try {
      const cached = loadFromCache()

      // Si hay cache y no es full sync forzado
      if (cached && !forceFullSync) {

      // Mostrar página actual desde cache inmediatamente
      const pageEntities = getEntitiesForPage(cached.entities, currentPage)
      setEntities(pageEntities)
      setTotalCount(cached.total_count)
      setTotalPages(Math.ceil(cached.total_count / 10))
      setLoading(false)

      // Extraer prefijos con sus timestamps individuales
      // Formato: "prefix:timestamp" para cada entidad
      const cachedPrefixesWithTimestamps = cached.entities.map(e => {
        const prefix = e.id.substring(0, 8)
        const timestamp = e.updated_at || e.created_at // Usar updated_at, fallback a created_at
        return `${prefix}:${timestamp}`
      })

      // Sync incremental en background CON PREFIJOS+TIMESTAMPS
      try {
        const response = await apiClient.listEntities(
          1,
          9999,
          undefined,  // Ya no necesitamos since global
          cachedPrefixesWithTimestamps
        )

        if (response && !response.error) {
          const data = response as any

          // MODO 1: Respuesta con prefijos (primera request con prefijos)
          if (data.sync_mode === 'incremental_prefixes') {
            const changes = data.changes?.modified_or_added || []
            const allValidPrefixes = data.changes?.all_valid_prefixes || []
            const collidingPrefixes = data.changes?.colliding_prefixes || []
            const needsFullIds = data.needs_full_ids_for_prefixes || []


            // Si hay prefijos faltantes, hacer segunda request con IDs completos
            if (needsFullIds.length > 0) {

              // Encontrar IDs completos que corresponden a esos prefijos
              const idsToVerify = cached.entities
                .filter(e => needsFullIds.includes(e.id.substring(0, 8)))
                .map(e => e.id)

              // Segunda request con IDs completos
              const verifyResponse = await apiClient.listEntities(
                1,
                9999,
                undefined,  // Ya no usamos since global
                undefined,
                idsToVerify
              )

              if (verifyResponse && !verifyResponse.error) {
                const verifyData = verifyResponse as any
                const confirmedDeletions = verifyData.changes?.confirmed_deletions || []


                // Aplicar cambios con eliminaciones confirmadas
                const updatedEntities = applyIncrementalChanges(
                  cached.entities,
                  changes,
                  confirmedDeletions
                )

                // Actualizar UI
                const pageEntities = getEntitiesForPage(updatedEntities, currentPage)
                setEntities(pageEntities)
                setTotalCount(data.total_count)
                setTotalPages(Math.ceil(data.total_count / 10))

                saveToCache(updatedEntities, data.total_count)
              }
            } else if (collidingPrefixes.length > 0) {
              // Hay colisiones pero no hay prefijos faltantes

              // Aplicar solo cambios (no eliminaciones)
              const updatedEntities = applyIncrementalChanges(
                cached.entities,
                changes,
                []
              )

              const pageEntities = getEntitiesForPage(updatedEntities, currentPage)
              setEntities(pageEntities)
              setTotalCount(data.total_count)
              setTotalPages(Math.ceil(data.total_count / 10))

              saveToCache(updatedEntities, data.total_count)
            } else {
              // No hay colisiones ni prefijos faltantes → detección perfecta
              // Extraer solo prefijos (sin timestamps) para comparar
              const cachedPrefixesOnly = cachedPrefixesWithTimestamps.map(pt => pt.split(':')[0])
              const cachedPrefixSet = new Set(cachedPrefixesOnly)
              const validPrefixSet = new Set(allValidPrefixes)

              // Prefijos que desaparecieron
              const deletedPrefixes = Array.from(cachedPrefixSet).filter(p => !validPrefixSet.has(p))
              const deletedIds = cached.entities
                .filter(e => deletedPrefixes.includes(e.id.substring(0, 8)))
                .map(e => e.id)


              const updatedEntities = applyIncrementalChanges(
                cached.entities,
                changes,
                deletedIds
              )

              const pageEntities = getEntitiesForPage(updatedEntities, currentPage)
              setEntities(pageEntities)
              setTotalCount(data.total_count)
              setTotalPages(Math.ceil(data.total_count / 10))

              saveToCache(updatedEntities, data.total_count)
            }
          }

          // MODO 2: Respuesta verificada (segunda request con IDs completos)
          else if (data.sync_mode === 'incremental_verified') {
            // Ya manejado arriba en el flujo de verificación
          }

          // MODO 3 (fallback): Sync con IDs completos (backward compatibility)
          else if (data.sync_mode === 'incremental') {
            const changes = data.changes?.modified_or_added || []
            const allValidIds = data.changes?.all_valid_ids || []
            const newTotalCount = data.total_count || cached.total_count

            // Detectar eliminaciones
            const cachedIds = cached.entities.map(e => e.id)
            const deletedIds = cachedIds.filter(id => !allValidIds.includes(id))

            if (deletedIds.length > 0 || changes.length > 0) {

              const updatedEntities = applyIncrementalChanges(
                cached.entities,
                changes,
                deletedIds
              )

              const pageEntities = getEntitiesForPage(updatedEntities, currentPage)
              setEntities(pageEntities)
              setTotalCount(newTotalCount)
              setTotalPages(Math.ceil(newTotalCount / 10))

              saveToCache(updatedEntities, newTotalCount)
            } else {
            }
          }
        }
      } catch (err) {
        console.error('Error in incremental sync:', err)
      }

      return
    }

    // Full sync: cargar TODAS las entities
    setLoading(true)

    try {
      const response = await apiClient.listEntities(1, 9999)
      if (response && !response.error) {
        const data = response as {
          entities?: Entity[];
          pagination?: {
            total_count: number;
            page_size: number;
            total_pages: number;
          };
          sync_timestamp?: string;
        }

        const allEntities = data.entities || []
        const pagination = data.pagination

        if (pagination) {
          // Guardar todas las entities en cache
          // NO pasar sync_timestamp - dejar que calcule desde created_at de entities
          saveToCache(
            allEntities,
            pagination.total_count
          )

          // Mostrar solo la página actual
          const pageEntities = getEntitiesForPage(allEntities, currentPage)
          setEntities(pageEntities)
          setTotalPages(Math.ceil(pagination.total_count / 10))
          setTotalCount(pagination.total_count)
        }
      }
    } catch (err) {
      console.error('Error fetching entities:', err)
      toast.error('Error cargando entidades')
    } finally {
      setLoading(false)
      fetchingRef.current = false  // Liberar lock
    }
    } catch (err) {
      console.error('Error in fetchEntities wrapper:', err)
      fetchingRef.current = false  // Liberar lock en caso de error
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

  const clearEntitiesCache = () => {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(ENTITIES_CACHE_KEY)) {
          localStorage.removeItem(key)
        }
      })
    } catch (err) {
      console.error('Error clearing cache:', err)
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
        clearEntitiesCache()
        fetchEntities(1, true)
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

    // Sync both entities and dian_emails caches
    fetchEntities(page)
    syncDianEmails()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, authLoading, user])
  // fetchEntities and syncDianEmails no están en deps intencionalmente para evitar loops
  // Se ejecuta solo cuando cambia page, authLoading, o user

  const filteredEntities = entities

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
            {totalCount} entidad{totalCount !== 1 ? 'es' : ''} encontrada{totalCount !== 1 ? 's' : ''}
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
                    // Lookup dian_email from cache
                    const dianEmailFromCache = getDianEmailFromCache(entity.dian_email_id)
                    const badgeInfo = dianEmailFromCache ? getDianEmailBadge(dianEmailFromCache.auth_status) : null

                    return (
                      <TableRow
                        key={entity.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/entities/${entity.id}`)}
                      >
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
                              {dianEmailFromCache?.email_masked && dianEmailFromCache.auth_status === 'active' && (
                                <p className="text-xs text-muted-foreground">
                                  {dianEmailFromCache.email_masked}
                                </p>
                              )}
                              {(dianEmailFromCache?.auth_status === 'expired' || dianEmailFromCache?.auth_status === 'revoked') && dianEmailFromCache.email_masked && (
                                <p className="text-xs text-muted-foreground">
                                  {dianEmailFromCache.email_masked}
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
        </div>

        {/* Right Column - Educational Content (1/3 width) */}
        <div className="space-y-2">
          {/* How to associate DIAN email */}
          <Card className="border-blue-200 bg-blue-50/30 sticky top-4">
            <CardHeader className="pb-1.5 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                Gestión Automática
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
                    <p className="font-medium text-blue-900">¡Asociación automática!</p>
                    <p className="text-muted-foreground text-[10px]">
                      Cuando llegue el token, el sistema detectará automáticamente qué email corresponde a esta entidad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <p className="font-medium text-green-600">Jobs sin tokens manuales</p>
                    <p className="text-muted-foreground text-[10px]">
                      Ya no necesitarás solicitar tokens manualmente - el sistema lo hará por ti.
                    </p>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200 py-1.5">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <AlertDescription className="text-[10px] text-amber-900 ml-5">
                  <strong>Importante:</strong> Si cambias el email DIAN, solicita un nuevo token y el sistema actualizará la asociación automáticamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
