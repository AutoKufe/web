'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileText, Building2, Check, ChevronsUpDown, RefreshCw, Info, Zap, Mail, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Entity {
  id: string
  display_name: string
  identifier_suffix: string
  entity_type: string
}

function NewJobContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedEntityId = searchParams.get('entity')

  // Entity selection
  const [entities, setEntities] = useState<Entity[]>([])
  const [loadingEntities, setLoadingEntities] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [entitySearchOpen, setEntitySearchOpen] = useState(false)

  // Token DIAN
  const [dianToken, setDianToken] = useState('')
  const [useNewToken, setUseNewToken] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'expired' | 'unknown'>('unknown')

  // Auto-token management
  const [autoTokenStatus, setAutoTokenStatus] = useState<{
    available: boolean
    status: 'available' | 'not_configured' | 'token_not_received' | 'email_expired'
    dianEmailMasked?: string
  } | null>(null)
  const [useAutoToken, setUseAutoToken] = useState(false)
  const [loadingAutoTokenStatus, setLoadingAutoTokenStatus] = useState(false)

  // Job config
  const [jobName, setJobName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Filtro de documentos
  const [documentFilter, setDocumentFilter] = useState('todos')
  const [useDefaultDocFilter, setUseDefaultDocFilter] = useState(true)

  // Intervalo de consolidado
  const [consolidationValue, setConsolidationValue] = useState('1')
  const [consolidationUnit, setConsolidationUnit] = useState('months')
  const [useDefaultConsolidation, setUseDefaultConsolidation] = useState(true)

  // Form states
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState<'form' | 'confirming' | 'success'>('form')
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [entityInfo, setEntityInfo] = useState<{ name: string; nit: string } | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)

  // Load entities on mount
  useEffect(() => {
    fetchEntities()
  }, [])

  // Auto-select entity if preselected
  useEffect(() => {
    if (preselectedEntityId && entities.length > 0) {
      const entity = entities.find(e => e.id === preselectedEntityId)
      if (entity) {
        handleSelectEntity(entity)
      }
    }
  }, [preselectedEntityId, entities])

  const fetchEntities = async () => {
    setLoadingEntities(true)
    try {
      const response = await apiClient.listEntities(1, 100)
      if (response && !response.error) {
        const data = response as { entities?: Entity[] }
        setEntities(data.entities || [])
      }
    } catch (err) {
      console.error('Error loading entities:', err)
      toast.error('Error cargando entidades')
    } finally {
      setLoadingEntities(false)
    }
  }

  const handleSelectEntity = async (entity: Entity) => {
    setSelectedEntity(entity)
    setEntitySearchOpen(false)

    // Reset states
    setTokenStatus('unknown')
    setAutoTokenStatus(null)
    setUseAutoToken(false)
    setLoadingAutoTokenStatus(true)

    try {
      // Consultar ambos endpoints en paralelo
      const [tokenResponse, autoTokenResponse] = await Promise.all([
        apiClient.getEntityTokenStatus(entity.id),
        apiClient.getEntityAutoTokenStatus(entity.id)
      ])

      // Procesar token status
      if (tokenResponse && !tokenResponse.error) {
        const data = tokenResponse as { has_valid_token?: boolean; needs_new_token?: boolean }

        if (data.has_valid_token) {
          setTokenStatus('valid')
          setUseNewToken(false)
        } else if (data.needs_new_token) {
          setTokenStatus('expired')
          setUseNewToken(true)
        } else {
          setTokenStatus('unknown')
          setUseNewToken(true)
        }
      } else {
        setTokenStatus('unknown')
        setUseNewToken(true)
      }

      // Procesar auto-token status
      if (autoTokenResponse && !autoTokenResponse.error) {
        const autoData = autoTokenResponse as {
          auto_token_available?: boolean
          status?: 'available' | 'not_configured' | 'token_not_received' | 'email_expired'
          dian_email_masked?: string
        }

        setAutoTokenStatus({
          available: autoData.auto_token_available || false,
          status: autoData.status || 'not_configured',
          dianEmailMasked: autoData.dian_email_masked
        })

        // Pre-seleccionar auto-token si está disponible
        if (autoData.auto_token_available) {
          setUseAutoToken(true)
          setUseNewToken(false)
        }
      }
    } catch (err) {
      console.error('Error checking token status:', err)
      setTokenStatus('unknown')
      setUseNewToken(true)
    } finally {
      setLoadingAutoTokenStatus(false)
    }
  }

  const handleSubmit = async (confirmEntity = false) => {
    if (!selectedEntity && !dianToken.trim()) {
      toast.error('Selecciona una entidad o ingresa un token DIAN')
      return
    }

    if (!startDate || !endDate) {
      toast.error('Selecciona el rango de fechas')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('La fecha de inicio debe ser anterior a la fecha de fin')
      return
    }

    // Si usa auto-token, no necesita validación de token manual
    if (!useAutoToken) {
      // Si la entidad tiene token válido y no se pidió nuevo token
      if (selectedEntity && tokenStatus === 'valid' && !useNewToken) {
        // Usar token almacenado
        if (!dianToken.trim()) {
          toast.error('Token DIAN requerido')
          return
        }
      }

      // Si se requiere nuevo token
      if (useNewToken || !selectedEntity) {
        if (!dianToken.trim()) {
          toast.error('Ingresa el token DIAN')
          return
        }
      }
    }

    setCreating(true)

    try {
      // Preparar intervalo de consolidado
      let consolidationInterval
      if (useDefaultConsolidation) {
        consolidationInterval = { value: 1, unit: 'months' }
      } else {
        consolidationInterval = {
          value: parseInt(consolidationValue),
          unit: consolidationUnit
        }
      }

      // Preparar filtro de documentos
      const finalDocFilter = useDefaultDocFilter ? 'todos' : documentFilter

      // Determinar token a enviar
      let tokenToSend = dianToken
      if (useAutoToken) {
        tokenToSend = 'use_auto_token'
      } else if (!dianToken.trim()) {
        tokenToSend = 'use_stored_token'
      }

      const response = await apiClient.createJobWithToken(
        tokenToSend,
        {
          entity_id: selectedEntity?.id,
          job_name: jobName.trim() || undefined,
          date_range: {
            start_date: startDate,
            end_date: endDate,
          },
          document_filter: finalDocFilter,
          consolidation_interval: consolidationInterval,
        },
        confirmEntity,
        traceId || undefined
      )

      if (response.error) {
        if (response.error === 'ENTITY_CONFIRMATION_REQUIRED') {
          const data = response as {
            entity_info?: { display_name?: string; nit?: string }
            trace_id?: string
          }
          setEntityInfo({
            name: data.entity_info?.display_name || 'Desconocido',
            nit: data.entity_info?.nit || 'N/A',
          })
          setTraceId(data.trace_id || null)
          setStep('confirming')
          setCreating(false)
          return
        }

        toast.error(response.message || 'Error creando job')
        setCreating(false)
        return
      }

      const successData = response as { job_id?: string }
      setCreatedJobId(successData.job_id || null)
      setStep('success')
      toast.success('Job creado exitosamente')
    } catch (err) {
      console.error('Error creating job:', err)
      toast.error('Error creando job')
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmEntity = () => {
    handleSubmit(true)
  }

  const resetForm = () => {
    setStep('form')
    setDianToken('')
    setJobName('')
    setStartDate('')
    setEndDate('')
    setDocumentFilter('todos')
    setConsolidationValue('1')
    setConsolidationUnit('months')
    setUseDefaultDocFilter(true)
    setUseDefaultConsolidation(true)
    setSelectedEntity(null)
    setUseNewToken(false)
    setAutoTokenStatus(null)
    setUseAutoToken(false)
    setEntityInfo(null)
    setTraceId(null)
    setCreatedJobId(null)
  }

  if (step === 'success') {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Job Creado Exitosamente</h2>
              <p className="text-muted-foreground mb-6">
                Tu job ha sido enviado para procesamiento
              </p>
              <div className="flex gap-4 justify-center">
                <Link href={`/jobs/${createdJobId}`}>
                  <Button size="lg">Ver Estado del Job</Button>
                </Link>
                <Button variant="outline" size="lg" onClick={resetForm}>
                  Crear Otro Job
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'confirming') {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Confirmar Entidad
            </CardTitle>
            <CardDescription>
              Esta entidad no está registrada en tu cuenta. ¿Deseas registrarla y crear el job?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{entityInfo?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Identificador</p>
                  <p className="font-mono">****{entityInfo?.nit}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep('form')}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmEntity}
                disabled={creating}
                className="flex-1"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Confirmar y Crear Job'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jobs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Job</h1>
          <p className="text-muted-foreground mt-1">
            Crea un nuevo trabajo de procesamiento DIAN
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Configuración del Job</CardTitle>
          <CardDescription>
            Ingresa los datos necesarios para procesar documentos DIAN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selector de Entidad */}
          <div className="space-y-2">
            <Label>Entidad *</Label>
            <Popover open={entitySearchOpen} onOpenChange={setEntitySearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={entitySearchOpen}
                  className="w-full justify-between"
                >
                  {selectedEntity ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedEntity.display_name}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        ****{selectedEntity.identifier_suffix}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Selecciona una entidad...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nombre o identificador..." />
                  <CommandList>
                    <CommandEmpty>
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          No se encontraron entidades
                        </p>
                        <Link href="/entities">
                          <Button variant="outline" size="sm">
                            <Building2 className="h-4 w-4 mr-2" />
                            Registrar Entidad
                          </Button>
                        </Link>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {entities.map((entity) => (
                        <CommandItem
                          key={entity.id}
                          value={`${entity.display_name} ${entity.identifier_suffix}`}
                          onSelect={() => handleSelectEntity(entity)}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedEntity?.id === entity.id ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{entity.display_name}</span>
                            <span className="text-muted-foreground font-mono text-xs">
                              ****{entity.identifier_suffix}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Selecciona la entidad para la cual deseas procesar documentos
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchEntities}
                disabled={loadingEntities}
              >
                <RefreshCw className={`h-3 w-3 ${loadingEntities ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Token DIAN y Auto-Token Management */}
          {selectedEntity && (
            <div className="space-y-4">
              {/* Loading state */}
              {loadingAutoTokenStatus && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription className="ml-2">
                    Verificando estado del token...
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-token available */}
              {!loadingAutoTokenStatus && autoTokenStatus?.available && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <Zap className="h-4 w-4 text-green-500" />
                  <AlertDescription className="ml-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-medium text-green-600">
                          Gestión automática de tokens disponible
                        </span>
                        <p className="text-xs text-muted-foreground">
                          AutoKufe puede solicitar tokens DIAN automáticamente para esta entidad
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="use-auto-token"
                          checked={useAutoToken}
                          onCheckedChange={(checked) => {
                            setUseAutoToken(checked as boolean)
                            if (checked) {
                              setUseNewToken(false)
                              setDianToken('')
                            }
                          }}
                        />
                        <Label htmlFor="use-auto-token" className="text-sm cursor-pointer">
                          Usar automático
                        </Label>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-token not configured */}
              {!loadingAutoTokenStatus && autoTokenStatus?.status === 'not_configured' && (
                <Alert>
                  <Info className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="ml-2">
                    <div className="space-y-1">
                      <span className="font-medium">Gestión automática no disponible</span>
                      <p className="text-xs text-muted-foreground">
                        Esta entidad aún no tiene un email DIAN vinculado. Una vez que AutoKufe reciba
                        un token para esta entidad vía email, la gestión automática se activará.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-token not received */}
              {!loadingAutoTokenStatus && autoTokenStatus?.status === 'token_not_received' && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="ml-2">
                    <div className="space-y-1">
                      <span className="font-medium text-yellow-600">Token no recibido</span>
                      <p className="text-xs text-muted-foreground">
                        La última solicitud automática de token no llegó. Por favor verifica que el
                        email DIAN esté correctamente configurado y tiene acceso para solicitar tokens.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-token email expired */}
              {!loadingAutoTokenStatus && autoTokenStatus?.status === 'email_expired' && (
                <Alert className="border-red-500/50 bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="ml-2">
                    <div className="space-y-1">
                      <span className="font-medium text-red-600">Email DIAN expirado</span>
                      <p className="text-xs text-muted-foreground">
                        El email que gestionaba tokens para esta entidad ya no está disponible
                        {autoTokenStatus.dianEmailMasked && (
                          <span className="font-mono"> ({autoTokenStatus.dianEmailMasked})</span>
                        )}
                        . Configura un nuevo email DIAN para reactivar la gestión automática.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Token manual (cuando no usa auto-token) */}
              {!loadingAutoTokenStatus && !useAutoToken && (
                <>
                  {tokenStatus === 'valid' && !useNewToken && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertDescription className="ml-2">
                        <div className="flex items-center justify-between">
                          <span>Esta entidad tiene un token DIAN válido guardado</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUseNewToken(true)}
                          >
                            Usar nuevo token
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {(tokenStatus === 'expired' || tokenStatus === 'unknown' || useNewToken) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="dian-token">
                          Token DIAN {tokenStatus === 'valid' && useNewToken && '(Nuevo)'}*
                        </Label>
                        {tokenStatus === 'valid' && useNewToken && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUseNewToken(false)}
                          >
                            Usar token guardado
                          </Button>
                        )}
                      </div>
                      <Input
                        id="dian-token"
                        placeholder="https://catalogo-vpfe.dian.gov.co/..."
                        value={dianToken}
                        onChange={(e) => setDianToken(e.target.value)}
                        className="font-mono text-sm"
                      />
                      {tokenStatus === 'expired' && (
                        <p className="text-xs text-yellow-600">
                          El último token guardado estaba expirado. Ingresa uno nuevo.
                        </p>
                      )}
                      {tokenStatus === 'unknown' && (
                        <p className="text-xs text-muted-foreground">
                          Esta entidad no tiene un token DIAN gestionado previamente
                        </p>
                      )}
                      {tokenStatus === 'valid' && useNewToken && (
                        <p className="text-xs text-muted-foreground">
                          El token actual será reemplazado por este nuevo token
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!selectedEntity && (
            <div className="space-y-2">
              <Label htmlFor="dian-token">Token DIAN *</Label>
              <Input
                id="dian-token"
                placeholder="https://catalogo-vpfe.dian.gov.co/..."
                value={dianToken}
                onChange={(e) => setDianToken(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Pega la URL completa del token que obtuviste del portal DIAN
              </p>
            </div>
          )}

          {/* Nombre del Job (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="job-name">Nombre del Job (opcional)</Label>
            <Input
              id="job-name"
              placeholder="Ej: Facturas Enero 2024"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si no ingresas un nombre, se generará automáticamente
            </p>
          </div>

          {/* Rango de Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Fecha Inicio *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Fecha Fin *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Filtro de Documentos */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-default-filter"
                checked={useDefaultDocFilter}
                onCheckedChange={(checked) => setUseDefaultDocFilter(checked as boolean)}
              />
              <Label
                htmlFor="use-default-filter"
                className="text-sm font-normal cursor-pointer"
              >
                Usar predeterminado (Todos los documentos)
              </Label>
            </div>
            {!useDefaultDocFilter && (
              <div className="space-y-2">
                <Label>Filtro de Documentos</Label>
                <Select value={documentFilter} onValueChange={setDocumentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los documentos</SelectItem>
                    <SelectItem value="ingresos">Ingresos</SelectItem>
                    <SelectItem value="egresos">Egresos</SelectItem>
                    <SelectItem value="nominas">Nóminas</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Filtra qué tipo de documentos quieres procesar
                </p>
              </div>
            )}
          </div>

          {/* Intervalo de Consolidado */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-default-consolidation"
                  checked={useDefaultConsolidation}
                  onCheckedChange={(checked) => setUseDefaultConsolidation(checked as boolean)}
                />
                <Label
                  htmlFor="use-default-consolidation"
                  className="text-sm font-normal cursor-pointer"
                >
                  Usar predeterminado (Mensual)
                </Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Intervalo de Consolidado</h4>
                    <p className="text-xs text-muted-foreground">
                      Define el intervalo de tiempo para la hoja resumen de consolidado en el Excel.
                      El consolidado agrupa los documentos por periodo y muestra totales de impuestos,
                      ingresos, egresos, etc.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {!useDefaultConsolidation && (
              <div className="space-y-2">
                <Label>Intervalo de Consolidado</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="1"
                    value={consolidationValue}
                    onChange={(e) => setConsolidationValue(e.target.value)}
                    className="w-24"
                  />
                  <Select value={consolidationUnit} onValueChange={setConsolidationUnit}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Días</SelectItem>
                      <SelectItem value="weeks">Semanas</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ej: "15 días" agrupa documentos cada 15 días en el consolidado
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4 border-t">
            <Link href="/jobs" className="flex-1">
              <Button variant="outline" className="w-full" size="lg">
                Cancelar
              </Button>
            </Link>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={
                creating ||
                !selectedEntity ||
                !startDate ||
                !endDate ||
                // Si usa auto-token, no necesita token manual
                (!useAutoToken && useNewToken && !dianToken.trim()) ||
                (!useAutoToken && tokenStatus !== 'valid' && !dianToken.trim())
              }
              className="flex-1"
              size="lg"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : useAutoToken ? (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Crear Job (Auto-Token)
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Crear Job
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewJobPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    }>
      <NewJobContent />
    </Suspense>
  )
}
