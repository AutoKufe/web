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
  Building2,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  MoreHorizontal
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
  nit: string
  entity_type: string
  token_valid: boolean
  last_token_check?: string
  created_at: string
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entidades</h1>
          <p className="text-muted-foreground">
            Gestiona tus empresas registradas en AutoKufe
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
        <CardHeader>
          <CardTitle>Entidades Registradas</CardTitle>
          <CardDescription>
            {entities.length} entidad{entities.length !== 1 ? 'es' : ''} encontrada{entities.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? 'No se encontraron entidades con ese criterio'
                  : 'No tienes entidades registradas aún'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setRegisterDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar primera entidad
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>NIT</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Token DIAN</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{entity.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{entity.nit}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entity.entity_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {entity.token_valid ? (
                          <Badge variant="default" className="bg-green-500">Válido</Badge>
                        ) : (
                          <Badge variant="destructive">Expirado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(entity.created_at).toLocaleDateString()}
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
                              <Link href={`/entities/${entity.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver detalles
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/jobs/new?entity=${entity.id}`}>
                                <Plus className="h-4 w-4 mr-2" />
                                Crear job
                              </Link>
                            </DropdownMenuItem>
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
