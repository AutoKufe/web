'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
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
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileText, Building2, Check, ChevronsUpDown, RefreshCw, Info, Zap, Mail, XCircle, FlaskConical, Sparkles } from 'lucide-react'
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
import { apiClient } from '@/lib/api/client'

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

// Extract 'rk' parameter from DIAN token URL
// Token format: https://catalogo-vpfe.dian.gov.co/User/AuthToken?pk=...&rk=901911696&token=...
const extractRkFromToken = (tokenUrl: string): string | null => {
  try {
    const url = new URL(tokenUrl)
    return url.searchParams.get('rk')
  } catch {
    // Try regex fallback for malformed URLs
    const match = tokenUrl.match(/[?&]rk=(\d+)/)
    return match ? match[1] : null
  }
}

// Error code to user-friendly message mapping
const TOKEN_ERROR_MESSAGES: Record<string, string> = {
  'INVALID_URL': 'La URL del token DIAN no es valida',
  'METADATA_EXTRACTION_FAILED': 'No se pudo leer la informacion del token',
  'TOKEN_EXPIRED': 'El token DIAN ha expirado',
  'TOKEN_INVALID': 'El token DIAN no es valido',
  'ENTITY_NOT_FOUND': 'Entidad no encontrada',
  'TOKEN_ENTITY_MISMATCH': 'El token pertenece a otra entidad',
  'INTERNAL_ERROR': 'Ocurrio un error. El equipo tecnico ha sido notificado.',
}

const getTokenErrorMessage = (errorCode?: string): string => {
  if (!errorCode) return 'Error desconocido'
  return TOKEN_ERROR_MESSAGES[errorCode] || 'Error desconocido'
}

// Validate that DIAN token matches selected entity by comparing identifier suffix
// Returns error message if mismatch, null if valid
const validateTokenMatchesEntity = (
  tokenUrl: string,
  entitySuffix: string
): string | null => {
  const rk = extractRkFromToken(tokenUrl)
  if (!rk) {
    return 'El token DIAN no tiene un formato valido (falta parametro rk)'
  }

  const rkSuffix = rk.slice(-4)
  if (rkSuffix !== entitySuffix) {
    return `El token DIAN es de otra entidad (termina en ${rkSuffix}). La entidad seleccionada termina en ${entitySuffix}.`
  }

  return null // Valid
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
  const [dianTokenError, setDianTokenError] = useState<string | null>(null)
  const [useNewToken, setUseNewToken] = useState(false)
  const [useAutoToken, setUseAutoToken] = useState(false)

  // Validation phase for progressive UX
  type ValidationPhase = 'idle' | 'validating' | 'verifying' | 'updating' | 'success' | 'success_sparkle' | 'error'
  const [validationPhase, setValidationPhase] = useState<ValidationPhase>('idle')
  const [representativeUpdated, setRepresentativeUpdated] = useState(false)

  // Debounce ref for server validation
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const phaseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sparkleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Progressive phase messages (if validation takes long)
  useEffect(() => {
    if (validationPhase === 'validating') {
      // After 3s, show "Verificando con DIAN..."
      phaseTimeoutRef.current = setTimeout(() => {
        setValidationPhase('verifying')
      }, 3000)

      return () => {
        if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current)
      }
    }
    if (validationPhase === 'verifying') {
      // After 2s more, show "Actualizando datos..."
      phaseTimeoutRef.current = setTimeout(() => {
        setValidationPhase('updating')
      }, 2000)

      return () => {
        if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current)
      }
    }
  }, [validationPhase])

  // Sparkle animation timeout (return to normal success after 2.5s)
  useEffect(() => {
    if (validationPhase === 'success_sparkle') {
      sparkleTimeoutRef.current = setTimeout(() => {
        setValidationPhase('success')
        setRepresentativeUpdated(false)
      }, 2500)

      return () => {
        if (sparkleTimeoutRef.current) clearTimeout(sparkleTimeoutRef.current)
      }
    }
  }, [validationPhase])

  // Server-side token validation with debounce
  const validateTokenWithServer = useCallback(async (tokenUrl: string, entityId?: string) => {
    // Clear previous timeouts
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current)
    }

    // Reset validation state
    setValidationPhase('idle')

    // Don't validate empty or short tokens
    if (!tokenUrl.trim() || tokenUrl.length < 50) {
      return
    }

    // Check URL structure first (instant)
    if (!tokenUrl.includes('catalogo-vpfe.dian.gov.co')) {
      return
    }

    // Start debounce timer (800ms after user stops typing)
    setValidationPhase('validating')
    validationTimeoutRef.current = setTimeout(async () => {
      try {
        // Pass entityId to save token if valid
        const result = await apiClient.quickValidateDianToken(tokenUrl, entityId)

        if (result.valid) {
          setDianTokenError(null)

          // Check if representative was updated (sparkle animation)
          if (result.representative_updated) {
            setRepresentativeUpdated(true)
            setValidationPhase('success_sparkle')
          } else {
            setValidationPhase('success')
          }
        } else {
          // Map error code to user-friendly message
          const errorMessage = getTokenErrorMessage(result.error_code)
          setDianTokenError(errorMessage)
          setValidationPhase('error')
        }
      } catch {
        // Network error - show friendly message
        setDianTokenError(getTokenErrorMessage('INTERNAL_ERROR'))
        setValidationPhase('error')
      }
    }, 800)
  }, [])

  // Handler for token input with instant validation
  const handleDianTokenChange = (value: string) => {
    setDianToken(value)

    // Reset validation state
    setValidationPhase('idle')
    setRepresentativeUpdated(false)

    // Instant validation: check entity match (for juridica by rk suffix)
    if (selectedEntity && value.trim()) {
      const error = validateTokenMatchesEntity(value, selectedEntity.identifier_suffix)
      setDianTokenError(error)

      // If entity match is OK, trigger server validation with entity_id
      if (!error) {
        validateTokenWithServer(value, selectedEntity.id)
      }
    } else {
      setDianTokenError(null)

      // No entity selected - validate token without saving
      if (value.trim()) {
        validateTokenWithServer(value)
      }
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [])

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
    setDianTokenError(null)
    setValidationPhase('idle')
    setRepresentativeUpdated(false)
    // Clear validation timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
  }

  const handleSubmit = async () => {
    if (!selectedEntity && !dianToken.trim()) {
      toast.error('Selecciona una entidad o ingresa un token DIAN')
      return
    }

    if (jobName) {
      const error = validateJobName(jobName)
      if (error) {
        toast.error(`Nombre de trabajo invalido: ${error}`)
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

    // Validate token matches selected entity (instant check using identifier_suffix)
    // Only validate if: entity selected + new token provided (not auto, not stored, not dev)
    if (selectedEntity && dianToken.trim() && !useAutoToken && !isDevJob) {
      const tokenMismatchError = validateTokenMatchesEntity(dianToken, selectedEntity.identifier_suffix)
      if (tokenMismatchError) {
        toast.error(tokenMismatchError)
        return
      }
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
      })

      setCreatedJobId(result.job_id || null)
      setStep('success')
      toast.success('Trabajo creado exitosamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creando trabajo')
    }
  }

  const resetForm = () => {
    setStep('form')
    setDianToken('')
    setDianTokenError(null)
    setValidationPhase('idle')
    setRepresentativeUpdated(false)
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
    // Clear validation timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
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
                <Link href={`/trabajos/${createdJobId}`}>
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
          <CardTitle className="text-xl">Configuracion del Trabajo</CardTitle>
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

          {/* Token DIAN section - Clean unified design */}
          <div className="space-y-2">
            <Label htmlFor="dian-token">Token DIAN *</Label>
            <div className="relative">
              <Input
                id="dian-token"
                placeholder={
                  loadingJobOptions
                    ? 'Verificando opciones...'
                    : useAutoToken
                    ? 'Se solicitara automaticamente'
                    : !useNewToken && savedTokenAvailable
                    ? `Usando token guardado (${tokenMasked || '****'})`
                    : 'https://catalogo-vpfe.dian.gov.co/...'
                }
                value={dianToken}
                onChange={(e) => {
                  handleDianTokenChange(e.target.value)
                  // If user starts typing, disable auto/stored token
                  if (e.target.value.trim()) {
                    if (useAutoToken) setUseAutoToken(false)
                    if (!useNewToken && savedTokenAvailable) setUseNewToken(true)
                  }
                }}
                disabled={loadingJobOptions || useAutoToken || (!useNewToken && savedTokenAvailable)}
                className={`font-mono text-sm pr-10 ${
                  dianTokenError || validationPhase === 'error'
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : validationPhase === 'success' || validationPhase === 'success_sparkle' || useAutoToken || (!useNewToken && savedTokenAvailable)
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : ''
                } ${(useAutoToken || (!useNewToken && savedTokenAvailable)) ? 'bg-green-50/50' : ''} ${validationPhase === 'success_sparkle' ? 'bg-amber-50/50' : ''}`}
              />
              {/* Status indicator inside input */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {loadingJobOptions ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : useAutoToken ? (
                  <Zap className="h-4 w-4 text-green-500" />
                ) : !useNewToken && savedTokenAvailable ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : dianToken.trim() ? (
                  validationPhase === 'validating' || validationPhase === 'verifying' || validationPhase === 'updating' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : validationPhase === 'success_sparkle' ? (
                    <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                  ) : validationPhase === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : validationPhase === 'error' || dianTokenError ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : null
                ) : null}
              </div>
            </div>

            {/* Status message and options row */}
            <div className="flex items-center justify-between">
              {/* Left: Status message */}
              <div className="flex-1">
                {loadingJobOptions ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando opciones disponibles...
                  </p>
                ) : dianTokenError ? (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {dianTokenError}
                  </p>
                ) : useAutoToken ? (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Gestion automatica activada
                  </p>
                ) : !useNewToken && savedTokenAvailable ? (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Token guardado listo para usar
                  </p>
                ) : validationPhase === 'success_sparkle' ? (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    Representante legal actualizado
                  </p>
                ) : validationPhase === 'success' ? (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Token DIAN valido
                  </p>
                ) : validationPhase === 'validating' ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Validando...
                  </p>
                ) : validationPhase === 'verifying' ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando con DIAN...
                  </p>
                ) : validationPhase === 'updating' ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Actualizando datos...
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {selectedEntity ? 'Pega la URL del token DIAN' : 'Pega la URL completa del token DIAN'}
                  </p>
                )}
              </div>

              {/* Right: Quick options (only when entity selected and options loaded) */}
              {selectedEntity && !loadingJobOptions && (autoTokenAvailable || savedTokenAvailable) && (
                <div className="flex items-center gap-4 ml-4">
                  {savedTokenAvailable && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={!useNewToken && !useAutoToken}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setUseNewToken(false)
                            setUseAutoToken(false)
                            setDianToken('')
                            setDianTokenError(null)
                            setValidationPhase('idle')
                          } else {
                            setUseNewToken(true)
                          }
                        }}
                        className="h-3.5 w-3.5 data-[state=checked]:bg-green-600"
                      />
                      <span className="text-xs text-muted-foreground">Guardado</span>
                    </label>
                  )}
                  {autoTokenAvailable && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={useAutoToken}
                        onCheckedChange={(checked) => {
                          setUseAutoToken(checked as boolean)
                          if (checked) {
                            setUseNewToken(false)
                            setDianToken('')
                            setDianTokenError(null)
                            setValidationPhase('idle')
                          }
                        }}
                        className="h-3.5 w-3.5 data-[state=checked]:bg-green-600"
                      />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Auto
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Job Name */}
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
