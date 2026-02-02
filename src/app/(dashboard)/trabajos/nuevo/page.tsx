'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileText, Building2, Check, ChevronsUpDown, RefreshCw, Info, Zap, Mail, XCircle, FlaskConical } from 'lucide-react'
import { useUserRoles } from '@/lib/hooks/use-user-roles'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useEntitiesSelector,
  useEntityJobCreationOptions,
  useCachedExcelCheck,
  useCreateJob,
  type EntitySelectorItem,
} from '@/lib/query'

// Helper to get Colombia local date (UTC-5)
const getColombiaToday = () => {
  const now = new Date()
  const colombiaOffset = -5 * 60
  const localOffset = now.getTimezoneOffset()
  const colombiaTime = new Date(now.getTime() + (colombiaOffset - localOffset) * 60 * 1000)
  return colombiaTime.toISOString().split('T')[0]
}

const getColombiaMonth = () => {
  const now = new Date()
  const colombiaOffset = -5 * 60
  const localOffset = now.getTimezoneOffset()
  const colombiaTime = new Date(now.getTime() + (colombiaOffset - localOffset) * 60 * 1000)
  return colombiaTime.toISOString().slice(0, 7)
}

function NewJobContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // User roles for dev mode
  const { isDev: hasDevRole, loading: rolesLoading } = useUserRoles()
  const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging'

  // React Query hooks
  const { data: entitiesData, isLoading: loadingEntities, refetch: refetchEntities } = useEntitiesSelector()
  const createJobMutation = useCreateJob()

  const entities = entitiesData?.entities || []

  // Entity selection
  const [selectedEntity, setSelectedEntity] = useState<EntitySelectorItem | null>(null)
  const [entitySearchOpen, setEntitySearchOpen] = useState(false)

  // Job creation options (fetched when entity is selected)
  const { data: jobOptions, isLoading: loadingJobOptions } = useEntityJobCreationOptions(
    selectedEntity?.id
  )

  // Dev job mode state
  const [isDevJob, setIsDevJob] = useState(false)

  // Token DIAN
  const [dianToken, setDianToken] = useState('')
  const [useNewToken, setUseNewToken] = useState(false)
  const [useAutoToken, setUseAutoToken] = useState(false)

  // Job config
  const [jobName, setJobName] = useState('')
  const [jobNameError, setJobNameError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Sheet types (multi-select)
  const [selectedSheetTypes, setSelectedSheetTypes] = useState<string[]>(['ingresos', 'egresos', 'nominas'])

  // Date selection mode
  const [dateSelectionMode, setDateSelectionMode] = useState<'days' | 'months'>('months')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')

  // Consolidation interval
  const [consolidationValue, setConsolidationValue] = useState('1')
  const [consolidationUnit, setConsolidationUnit] = useState('months')
  const [useTotalConsolidation, setUseTotalConsolidation] = useState(true)

  // Form states
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)

  // Dev cache check
  const { data: devCacheStatus, isLoading: loadingDevCache } = useCachedExcelCheck(
    selectedEntity?.id,
    startDate,
    endDate,
    isDevJob && !!selectedEntity && !!startDate && !!endDate
  )

  // Auto-select entity if preselected in URL
  useEffect(() => {
    const preselectedEntityId = searchParams.get('entity')
    if (preselectedEntityId && entities.length > 0 && !selectedEntity) {
      const entity = entities.find(e => e.id === preselectedEntityId)
      if (entity) {
        setSelectedEntity(entity)
      }
    }
  }, [searchParams, entities, selectedEntity])

  // Apply recommended option when job options load
  useEffect(() => {
    if (!jobOptions) return

    if (jobOptions.recommended_option === 'auto' && jobOptions.auto_management.available) {
      setUseAutoToken(true)
      setUseNewToken(false)
    } else if (jobOptions.recommended_option === 'saved' && jobOptions.saved_token.available) {
      setUseAutoToken(false)
      setUseNewToken(false)
    } else {
      setUseAutoToken(false)
      setUseNewToken(true)
    }
  }, [jobOptions])

  // Job name validation
  const validateJobName = (name: string): string | null => {
    if (!name) return null
    if (name.length > 20) return 'El nombre no puede exceder 20 caracteres'
    const forbiddenChars = /[<>:"/\\|?*\s]/
    if (forbiddenChars.test(name)) return 'No se permiten espacios ni caracteres especiales'
    const dangerousChars = /[$%#@!`~^{}[\]]/
    if (dangerousChars.test(name)) return 'No se permiten caracteres especiales'
    return null
  }

  const handleJobNameChange = (value: string) => {
    setJobName(value)
    setJobNameError(validateJobName(value))
  }

  const handleSelectEntity = (entity: EntitySelectorItem) => {
    setSelectedEntity(entity)
    setEntitySearchOpen(false)
    // Reset token states
    setUseAutoToken(false)
    setUseNewToken(false)
    setDianToken('')
  }

  const handleSubmit = async () => {
    if (!selectedEntity && !dianToken.trim()) {
      toast.error('Selecciona una entidad o ingresa un token DIAN')
      return
    }

    if (jobName) {
      const error = validateJobName(jobName)
      if (error) {
<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
        toast.error(`Nombre de trabajo invalido: ${error}`)
========
        toast.error(`Nombre de trabajo inválido: ${error}`)
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx
        return
      }
    }

    if (!startDate || !endDate) {
      toast.error('Selecciona el rango de fechas')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('La fecha de inicio debe ser anterior a la fecha final')
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDateObj = new Date(endDate)
    endDateObj.setHours(0, 0, 0, 0)

    if (endDateObj > today) {
      toast.error('La fecha final no puede ser mayor que hoy')
      return
    }

    // Token validation based on mode
    if (isDevJob) {
      if (!devCacheStatus?.available) {
        toast.error('El cache de raw Excel no esta disponible')
        return
      }
    } else if (!useAutoToken && !jobOptions?.saved_token.available && !dianToken.trim()) {
      toast.error('Ingresa el token DIAN')
      return
    } else if (!useAutoToken && jobOptions?.saved_token.available && useNewToken && !dianToken.trim()) {
      toast.error('Ingresa el nuevo token DIAN')
      return
    }

    if (selectedSheetTypes.length === 0) {
      toast.error('Selecciona al menos un tipo de hoja')
      return
    }

    // Prepare consolidation interval
    let consolidationInterval: string | { value: number; unit: string } | null
    if (useTotalConsolidation) {
      consolidationInterval = 'total'
    } else {
      consolidationInterval = {
        value: parseInt(consolidationValue),
        unit: consolidationUnit
      }
    }

    // Determine token to send
    let tokenToSend = dianToken
    if (isDevJob) {
      tokenToSend = ''
    } else if (useAutoToken) {
      tokenToSend = 'use_auto_token'
    } else if (!dianToken.trim()) {
      tokenToSend = 'use_stored_token'
    }

    try {
      const result = await createJobMutation.mutateAsync({
        dianToken: tokenToSend,
        jobData: {
          entity_id: selectedEntity?.id,
          job_name: jobName.trim() || undefined,
          date_range: {
            start_date: startDate,
            end_date: endDate,
          },
          document_categories: selectedSheetTypes,
          consolidation_interval: consolidationInterval,
          is_dev_job: isDevJob,
        }
<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
      })
========
      )

      if (response.error) {
        toast.error(response.message || 'Error creando trabajo')
        setCreating(false)
        return
      }

      const successData = response as {
        job_id?: string
        dian_email_status?: {
          has_active_oauth: boolean
          expired_emails: Array<{ email: string; expired_at: string }>
          pending_emails: Array<{ email: string; created_at: string }>
          total_emails: number
        }
      }
      setCreatedJobId(successData.job_id || null)

      // Capture DIAN email status if present
      if (successData.dian_email_status) {
        setDianEmailStatus(successData.dian_email_status)
      }
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx

      setCreatedJobId(result.job_id || null)
      setStep('success')
      toast.success('Trabajo creado exitosamente')
    } catch (err) {
<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
      toast.error(err instanceof Error ? err.message : 'Error creando trabajo')
========
      console.error('Error creating job:', err)
      toast.error('Error creando trabajo')
    } finally {
      setCreating(false)
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx
    }
  }

  const resetForm = () => {
    setStep('form')
    setDianToken('')
    setJobName('')
    setStartDate('')
    setEndDate('')
    setStartMonth('')
    setEndMonth('')
    setSelectedSheetTypes(['ingresos', 'egresos', 'nominas'])
    setConsolidationValue('1')
    setConsolidationUnit('months')
    setUseTotalConsolidation(true)
    setSelectedEntity(null)
    setUseNewToken(false)
    setUseAutoToken(false)
    setCreatedJobId(null)
    setIsDevJob(false)
  }

  // Derived states from job options
  const autoTokenAvailable = jobOptions?.auto_management.available || false
  const autoTokenStatus = jobOptions?.auto_management.status || 'not_configured'
  const dianEmailMasked = jobOptions?.auto_management.dian_email_masked
  const savedTokenAvailable = jobOptions?.saved_token.available || false
  const tokenMasked = jobOptions?.saved_token.token_masked

  if (step === 'success') {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Trabajo Creado Exitosamente</h2>
              <p className="text-muted-foreground mb-6">
                Tu trabajo ha sido enviado para procesamiento
              </p>
              <div className="flex gap-4 justify-center">
<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
                <Link href={`/trabajos/${createdJobId}`}>
========
                <Link href={`/jobs/${createdJobId}`}>
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx
                  <Button size="lg">Ver Estado del Trabajo</Button>
                </Link>
                <Button variant="outline" size="lg" onClick={resetForm}>
                  Crear Otro Trabajo
                </Button>
              </div>
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
        <Link href="/trabajos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Trabajo</h1>
          <p className="text-muted-foreground mt-1">
            Crea un nuevo trabajo de procesamiento DIAN
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
          <CardTitle className="text-xl">Configuracion del Trabajo</CardTitle>
========
          <CardTitle className="text-xl">Configuración del Trabajo</CardTitle>
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx
          <CardDescription>
            Ingresa los datos necesarios para procesar documentos DIAN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Selector */}
          <div className="space-y-2">
            <Label>Entidad *</Label>
            <Popover open={entitySearchOpen} onOpenChange={setEntitySearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={entitySearchOpen}
                  className="w-full justify-between"
                  disabled={loadingEntities}
                >
                  {loadingEntities ? (
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando entidades...
                    </span>
                  ) : selectedEntity ? (
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
                        <Link href="/entidades">
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
                onClick={() => refetchEntities()}
                disabled={loadingEntities}
              >
                <RefreshCw className={`h-3 w-3 ${loadingEntities ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* OAuth expired/pending alerts */}
          {selectedEntity && autoTokenStatus === 'oauth_expired' && (
            <Alert className="border-red-600/70 bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-red-700">Email DIAN expirado</p>
                  <p className="text-sm text-red-600">
                    {dianEmailMasked && <span className="font-mono">({dianEmailMasked})</span>} perdio acceso.
                  </p>
                  <Link href="/dian-emails">
                    <Button variant="destructive" size="sm">
                      <Mail className="h-4 w-4 mr-1.5" />
                      Re-autorizar ahora
                    </Button>
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {selectedEntity && autoTokenStatus === 'oauth_pending' && (
            <Alert className="border-yellow-600/70 bg-yellow-50">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-yellow-700">Email DIAN pendiente</p>
                  <p className="text-sm text-yellow-700">
                    Falta completar la autorizacion OAuth {dianEmailMasked && <span className="font-mono">({dianEmailMasked})</span>}
                  </p>
                  <Link href="/dian-emails">
                    <Button variant="outline" size="sm" className="border-yellow-600 text-yellow-700">
                      <Mail className="h-4 w-4 mr-1.5" />
                      Completar autorizacion
                    </Button>
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Token DIAN section */}
          {selectedEntity && (
            <div className="space-y-4">
              {/* Loading state */}
              {loadingJobOptions && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription className="ml-2">
                    Verificando estado del token...
                  </AlertDescription>
                </Alert>
              )}

              {/* Auto-token available */}
              {!loadingJobOptions && autoTokenAvailable && (
                <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-green-900">Gestion automatica disponible</h4>
                          <p className="text-sm text-green-700 mt-0.5">
                            AutoKufe puede solicitar tokens DIAN automaticamente
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <Label htmlFor="use-auto-token" className="text-sm font-medium text-green-900 cursor-pointer">
                            {useAutoToken ? 'Activado' : 'Usar automatico'}
                          </Label>
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
                            className="h-5 w-5 data-[state=checked]:bg-green-600"
                          />
                        </div>
                      </div>
                      {useAutoToken && (
                        <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">
<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
                            Token DIAN se solicitara automaticamente
========
                            Token DIAN se solicitará automáticamente al crear el trabajo
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Manual token (when not using auto-token) */}
              {!loadingJobOptions && !useAutoToken && (
                <div className="space-y-3">
                  {/* Saved token available */}
                  {savedTokenAvailable && (
                    <Card className="border-green-200 bg-green-50/50">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div>
                              <p className="text-sm font-medium text-green-900">Token DIAN guardado disponible</p>
                              <p className="text-xs text-green-700 font-mono mt-1">{tokenMasked || '****'}</p>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Checkbox
                                id="use-new-token"
                                checked={useNewToken}
                                onCheckedChange={(checked) => {
                                  setUseNewToken(checked as boolean)
                                  if (checked) setDianToken('')
                                }}
                              />
                              <Label htmlFor="use-new-token" className="text-xs text-green-800 cursor-pointer">
                                Solicitar nuevo token en su lugar
                              </Label>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* New token input */}
                  {(!savedTokenAvailable || useNewToken) && (
                    <div className="space-y-2">
                      <Label htmlFor="dian-token">Token DIAN *</Label>
                      <Input
                        id="dian-token"
                        placeholder="https://catalogo-vpfe.dian.gov.co/..."
                        value={dianToken}
                        onChange={(e) => {
                          setDianToken(e.target.value)
                          if (e.target.value.trim() && useAutoToken) {
                            setUseAutoToken(false)
                          }
                        }}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Pega la URL completa del token que obtuviste de la DIAN
                      </p>
                    </div>
                  )}
                </div>
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

<<<<<<<< HEAD:src/app/(dashboard)/trabajos/nuevo/page.tsx
          {/* Job Name */}
========
          {/* Nombre del Trabajo (opcional) */}
>>>>>>>> origin/main:src/app/(dashboard)/trabajos/new/page.tsx
          <div className="space-y-2">
            <Label htmlFor="job-name">Nombre del Trabajo (opcional)</Label>
            <Input
              id="job-name"
              placeholder="Ej: facturas_enero_2024"
              value={jobName}
              onChange={(e) => handleJobNameChange(e.target.value)}
              maxLength={20}
              className={jobNameError ? 'border-red-500' : ''}
            />
            {jobNameError ? (
              <p className="text-xs text-red-500">{jobNameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Si no ingresas un nombre, se generara automaticamente. Maximo 20 caracteres.
              </p>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Rango de Fechas *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Por:</span>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button
                    type="button"
                    variant={dateSelectionMode === 'months' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-3"
                    onClick={() => setDateSelectionMode('months')}
                  >
                    Meses
                  </Button>
                  <Button
                    type="button"
                    variant={dateSelectionMode === 'days' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-3"
                    onClick={() => setDateSelectionMode('days')}
                  >
                    Dias
                  </Button>
                </div>
              </div>
            </div>

            {dateSelectionMode === 'months' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-month">Mes Inicial</Label>
                    <Input
                      id="start-month"
                      type="month"
                      value={startMonth}
                      max={getColombiaMonth()}
                      onChange={(e) => {
                        const selectedMonth = e.target.value
                        setStartMonth(selectedMonth)
                        if (selectedMonth) {
                          const [year, month] = selectedMonth.split('-')
                          setStartDate(`${year}-${month}-01`)
                          const currentMonth = getColombiaMonth()
                          if (selectedMonth === currentMonth && !endMonth) {
                            setEndMonth(currentMonth)
                            setEndDate(getColombiaToday())
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-month">Mes Final</Label>
                    <Input
                      id="end-month"
                      type="month"
                      value={endMonth}
                      min={startMonth || undefined}
                      max={getColombiaMonth()}
                      onChange={(e) => {
                        setEndMonth(e.target.value)
                        if (e.target.value) {
                          const [year, month] = e.target.value.split('-')
                          const currentMonth = getColombiaMonth()
                          if (e.target.value === currentMonth) {
                            setEndDate(getColombiaToday())
                          } else {
                            const lastDay = new Date(parseInt(year), parseInt(month), 0)
                            setEndDate(lastDay.toISOString().split('T')[0])
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                {startMonth && endMonth && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    <span className="font-medium">Rango: </span>
                    {startDate} al {endDate}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Fecha Inicio</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    max={getColombiaToday()}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">Fecha Final</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    max={getColombiaToday()}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Document Categories */}
          <div className="space-y-2">
            <Label>Categorias de Documentos a Incluir *</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all-categories"
                          checked={selectedSheetTypes.length === 3}
                          onCheckedChange={(checked) => {
                            setSelectedSheetTypes(checked ? ['ingresos', 'egresos', 'nominas'] : [])
                          }}
                        />
                        <Label htmlFor="select-all-categories" className="font-medium cursor-pointer">
                          Seleccionar todas
                        </Label>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { value: 'ingresos', label: 'Ingresos' },
                    { value: 'egresos', label: 'Egresos' },
                    { value: 'nominas', label: 'Nominas' },
                  ].map((type) => (
                    <tr key={type.value} className="border-t">
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${type.value}`}
                            checked={selectedSheetTypes.includes(type.value)}
                            onCheckedChange={(checked) => {
                              setSelectedSheetTypes(
                                checked
                                  ? [...selectedSheetTypes, type.value]
                                  : selectedSheetTypes.filter((t) => t !== type.value)
                              )
                            }}
                          />
                          <Label htmlFor={`category-${type.value}`} className="text-sm font-normal cursor-pointer">
                            {type.label}
                          </Label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dev Mode (staging only + dev role) */}
          {isStaging && hasDevRole && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dev-job-mode"
                  checked={isDevJob}
                  onCheckedChange={(checked) => {
                    setIsDevJob(checked as boolean)
                    if (checked) {
                      setUseAutoToken(false)
                      setUseNewToken(false)
                      setDianToken('')
                    }
                  }}
                  className="h-5 w-5 data-[state=checked]:bg-yellow-600"
                />
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-yellow-600" />
                  <Label htmlFor="dev-job-mode" className="text-sm font-medium text-yellow-800 cursor-pointer">
                    Modo desarrollo (usar Excel cacheado)
                  </Label>
                </div>
              </div>

              {isDevJob && (
                <div className="pl-7 space-y-2">
                  {loadingDevCache ? (
                    <div className="flex items-center gap-2 text-sm text-yellow-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando cache...
                    </div>
                  ) : devCacheStatus?.available ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 text-sm ml-2">
                        <strong>Cache disponible</strong>
                      </AlertDescription>
                    </Alert>
                  ) : selectedEntity && startDate && endDate ? (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700 text-sm ml-2">
                        <strong>Cache no disponible.</strong> Ejecuta primero un job normal.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-xs text-yellow-700">
                      Selecciona una entidad y rango de fechas para verificar el cache
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-yellow-700 pl-7">
                Este modo usa el raw Excel cacheado de jobs anteriores.
              </p>
            </div>
          )}

          {/* Consolidation Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Intervalo de Consolidado *</Label>
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
                      Define el intervalo de tiempo para la hoja resumen en el Excel.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-total-consolidation"
                checked={useTotalConsolidation}
                onCheckedChange={(checked) => setUseTotalConsolidation(checked as boolean)}
              />
              <Label htmlFor="use-total-consolidation" className="text-sm font-normal cursor-pointer">
                Consolidado Total (sin dividir por intervalos)
              </Label>
            </div>

            {!useTotalConsolidation && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={consolidationValue}
                    onChange={(e) => setConsolidationValue(e.target.value)}
                    className="w-24"
                  />
                  <Select value={consolidationUnit} onValueChange={setConsolidationUnit}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">{consolidationValue === '1' ? 'Dia' : 'Dias'}</SelectItem>
                      <SelectItem value="weeks">{consolidationValue === '1' ? 'Semana' : 'Semanas'}</SelectItem>
                      <SelectItem value="months">{consolidationValue === '1' ? 'Mes' : 'Meses'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4 border-t">
            <Link href="/trabajos" className="flex-1">
              <Button variant="outline" className="w-full" size="lg">
                Cancelar
              </Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={
                createJobMutation.isPending ||
                !selectedEntity ||
                !startDate ||
                !endDate ||
                (isDevJob && !devCacheStatus?.available) ||
                (!isDevJob && !useAutoToken && !savedTokenAvailable && !dianToken.trim()) ||
                (!isDevJob && !useAutoToken && savedTokenAvailable && useNewToken && !dianToken.trim())
              }
              className="flex-1"
              size="lg"
            >
              {createJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Crear Trabajo
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
