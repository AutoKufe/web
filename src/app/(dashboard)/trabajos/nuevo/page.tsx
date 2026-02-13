'use client'

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
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileText, Building2, Check, ChevronsUpDown, RefreshCw, Info, Zap, Mail, XCircle, FlaskConical, Sparkles, Layers } from 'lucide-react'
// FlaskConical kept for dev mode
import { useUserRoles } from '@/lib/hooks/use-user-roles'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useEntitiesSelector,
  useEntityJobCreationOptions,
  useCachedExcelCheck,
  useCreateJob,
  useCreateBatchJobs,
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
  // Auto-token specific errors
  'COOLDOWN_ACTIVE': 'Debes esperar antes de solicitar otro token',
  'HOURLY_LIMIT_EXCEEDED': 'Has alcanzado el limite de solicitudes por hora (20/hora)',
  'DAILY_LIMIT_EXCEEDED': 'Has alcanzado el limite diario de solicitudes (75/dia)',
  'RATE_LIMIT_EXCEEDED': 'Has alcanzado el limite de solicitudes',
  'REQUEST_IN_PROGRESS': 'Ya hay una solicitud en progreso',
  'AUTO_TOKEN_NOT_CONFIGURED': 'La gestion automatica no esta configurada',
  'VALID_TOKEN_EXISTS': 'Ya existe un token valido',
  'OAUTH_EXPIRED': 'La autorizacion del email DIAN ha expirado',
  'DIAN_REQUEST_FAILED': 'No se pudo solicitar el token a DIAN',
  'TOKEN_NOT_RECEIVED': 'El token no llego. Intenta de nuevo.',
  'TWOCAPTCHA_NOT_CONFIGURED': 'Error de configuracion del sistema',
}

const getTokenErrorMessage = (errorCode?: string): string => {
  if (!errorCode) return 'Error desconocido'
  return TOKEN_ERROR_MESSAGES[errorCode] || 'Error desconocido'
}

// Auto-token request status messages
const AUTO_TOKEN_STATUS_MESSAGES: Record<string, string> = {
  'pending': 'Solicitando token DIAN...',
  'polling': 'Esperando respuesta de DIAN...',
  'received': 'Token recibido!',
  'failed': 'No se pudo obtener el token',
  'timeout': 'El token no llego a tiempo',
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
  const [entitySelectorShake, setEntitySelectorShake] = useState(false)

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

  // Validation phase for progressive UX
  type ValidationPhase = 'idle' | 'validating' | 'verifying' | 'updating' | 'success' | 'success_sparkle' | 'error'
  const [validationPhase, setValidationPhase] = useState<ValidationPhase>('idle')
  const [representativeUpdated, setRepresentativeUpdated] = useState(false)

  // Auto-token request state
  type AutoTokenStatus = 'idle' | 'pending' | 'polling' | 'received' | 'failed' | 'timeout'
  const [autoTokenRequestId, setAutoTokenRequestId] = useState<string | null>(null)
  const [autoTokenStatus, setAutoTokenStatus] = useState<AutoTokenStatus>('idle')
  const [autoTokenError, setAutoTokenError] = useState<string | null>(null)
  const [autoTokenStartedAt, setAutoTokenStartedAt] = useState<Date | null>(null)
  const autoTokenPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Token validation timestamp (to know if we need to revalidate on submit)
  const [tokenValidatedAt, setTokenValidatedAt] = useState<Date | null>(null)
  const TOKEN_VALIDATION_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

  // Ref for token input focus
  const dianTokenInputRef = useRef<HTMLInputElement>(null)

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
          setTokenValidatedAt(new Date()) // Track when token was validated

          // Check if representative was updated (sparkle animation)
          if (result.representative_updated) {
            setRepresentativeUpdated(true)
            setValidationPhase('success_sparkle')
          } else {
            setValidationPhase('success')
          }
        } else {
          // Map error code to user-friendly message
          const errorCode = typeof result.error_code === 'string' ? result.error_code : undefined
          const errorMessage = getTokenErrorMessage(errorCode)
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
    setTokenValidatedAt(null)

    // Instant validation: check entity match (for juridica by rk suffix)
    if (selectedEntity && value.trim()) {
      const error = validateTokenMatchesEntity(value, selectedEntity.identifier_suffix)
      setDianTokenError(error)

      // If entity match is OK, trigger server validation with entity_id
      if (!error) {
        validateTokenWithServer(value, selectedEntity.id)
      }
    } else if (value.trim() && value.includes('catalogo-vpfe.dian.gov.co')) {
      // No entity selected but valid-looking token pasted - prompt to select entity first
      setDianTokenError('Selecciona una entidad primero')
      setValidationPhase('error')
      // Shake the entity selector to draw attention
      setEntitySelectorShake(true)
      setTimeout(() => setEntitySelectorShake(false), 600)
    } else {
      setDianTokenError(null)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
      if (autoTokenPollingRef.current) {
        clearTimeout(autoTokenPollingRef.current)
      }
    }
  }, [])

  // Auto-token polling effect
  useEffect(() => {
    if (!autoTokenRequestId || autoTokenStatus === 'received' || autoTokenStatus === 'failed' || autoTokenStatus === 'timeout') {
      return
    }

    const pollStatus = async () => {
      try {
        const result = await apiClient.getAutoTokenStatus(autoTokenRequestId)

        if (!result.success) {
          setAutoTokenStatus('failed')
          const errCode = typeof result.error_code === 'string' ? result.error_code : undefined
          setAutoTokenError(getTokenErrorMessage(errCode))
          return
        }

        const status = result.status as AutoTokenStatus
        setAutoTokenStatus(status)

        if (status === 'received') {
          // Token received! Clear polling and show success
          setAutoTokenError(null)
          // Refresh job options to get new token status
          // The token is already saved to entity by backend
        } else if (status === 'failed' || status === 'timeout') {
          const errCode = typeof result.error_code === 'string' ? result.error_code : undefined
          setAutoTokenError(getTokenErrorMessage(errCode))
        } else {
          // Still pending/polling - continue polling
          autoTokenPollingRef.current = setTimeout(pollStatus, 3000)
        }
      } catch {
        // Network error - retry
        autoTokenPollingRef.current = setTimeout(pollStatus, 5000)
      }
    }

    // Start polling
    autoTokenPollingRef.current = setTimeout(pollStatus, 1000)

    return () => {
      if (autoTokenPollingRef.current) {
        clearTimeout(autoTokenPollingRef.current)
      }
    }
  }, [autoTokenRequestId, autoTokenStatus])

  // Check for active auto-token request when entity is selected
  useEffect(() => {
    if (!selectedEntity?.id) return

    const checkActiveRequest = async () => {
      try {
        const result = await apiClient.getActiveAutoTokenRequest(selectedEntity.id)
        if (result.has_active_request && typeof result.request_id === 'string') {
          // Restore active request state
          setAutoTokenRequestId(result.request_id)
          const status = typeof result.status === 'string' ? result.status as AutoTokenStatus : 'pending'
          setAutoTokenStatus(status)
          const requestedAt = typeof result.requested_at === 'string' ? result.requested_at : null
          setAutoTokenStartedAt(requestedAt ? new Date(requestedAt) : null)
        }
      } catch {
        // Ignore errors
      }
    }

    checkActiveRequest()
  }, [selectedEntity?.id])

  // Request auto-token handler
  const handleRequestAutoToken = async () => {
    if (!selectedEntity?.id) return

    // Reset previous state
    setAutoTokenError(null)
    setAutoTokenStatus('pending')
    setAutoTokenStartedAt(new Date())

    try {
      const result = await apiClient.requestAutoToken(selectedEntity.id)

      if (!result.success) {
        setAutoTokenStatus('failed')
        const errCode = typeof result.error_code === 'string' ? result.error_code : undefined
        setAutoTokenError(getTokenErrorMessage(errCode))

        // Show retry timer if cooldown
        if (errCode === 'COOLDOWN_ACTIVE' && result.retry_after_seconds) {
          setAutoTokenError(`Debes esperar ${result.retry_after_seconds} segundos`)
        }
        return
      }

      const requestId = typeof result.request_id === 'string' ? result.request_id : null
      setAutoTokenRequestId(requestId)
      setAutoTokenStatus('pending')
    } catch {
      setAutoTokenStatus('failed')
      setAutoTokenError(getTokenErrorMessage('INTERNAL_ERROR'))
    }
  }

  // Get elapsed time message for auto-token
  const getAutoTokenElapsedMessage = (): string => {
    if (!autoTokenStartedAt) return ''
    const elapsed = Math.floor((Date.now() - autoTokenStartedAt.getTime()) / 1000)

    if (elapsed < 10) return 'Solicitando token DIAN...'
    if (elapsed < 30) return 'Esperando respuesta de DIAN...'
    if (elapsed < 60) return 'Tomando mas tiempo del esperado...'
    if (elapsed < 120) return 'DIAN esta tardando en responder...'
    return 'Esto esta tomando demasiado tiempo...'
  }

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

    if (jobOptions.recommended_option === 'saved' && jobOptions.saved_token.available) {
      setUseNewToken(false)
    } else {
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
    setUseNewToken(false)
    setDianToken('')
    setDianTokenError(null)
    setValidationPhase('idle')
    setRepresentativeUpdated(false)
    setTokenValidatedAt(null)
    // Reset auto-token states
    setAutoTokenRequestId(null)
    setAutoTokenStatus('idle')
    setAutoTokenError(null)
    setAutoTokenStartedAt(null)
    // Reset dev job mode
    setIsDevJob(false)
    // Clear timeouts
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    if (autoTokenPollingRef.current) {
      clearTimeout(autoTokenPollingRef.current)
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
    // Auto-token received counts as having a valid saved token
    const hasAutoTokenReceived = autoTokenStatus === 'received'

    if (isDevJob) {
      if (!devCacheStatus?.available) {
        toast.error('El cache de raw Excel no esta disponible')
        return
      }
    } else if (!hasAutoTokenReceived && !jobOptions?.saved_token.available && !dianToken.trim()) {
      toast.error('Ingresa el token DIAN o solicita uno automatico')
      return
    } else if (!hasAutoTokenReceived && jobOptions?.saved_token.available && useNewToken && !dianToken.trim()) {
      toast.error('Ingresa el nuevo token DIAN')
      return
    }

    // Validate token matches selected entity (instant check using identifier_suffix)
    // Only validate if: entity selected + new token provided (not auto-received, not stored, not dev, not pseudo)
    if (selectedEntity && dianToken.trim() && !hasAutoTokenReceived && !isDevJob) {
      const tokenMismatchError = validateTokenMatchesEntity(dianToken, selectedEntity.identifier_suffix)
      if (tokenMismatchError) {
        toast.error(tokenMismatchError)
        return
      }
    }

    // For manual token: check if validated and if validation is still fresh (< 5 min)
    // Skip this check for: dev jobs, auto-token, pseudo jobs, or using saved token
    const isUsingManualToken = !isDevJob && !hasAutoTokenReceived && dianToken.trim() && (!savedTokenAvailable || useNewToken)

    if (isUsingManualToken && selectedEntity) {
      // Check if token was validated
      if (!tokenValidatedAt || validationPhase !== 'success' && validationPhase !== 'success_sparkle') {
        // Token not validated - focus input and show error
        toast.error('El token DIAN no ha sido validado')
        dianTokenInputRef.current?.focus()
        return
      }

      // Check if validation is stale (> 5 min)
      const validationAge = Date.now() - tokenValidatedAt.getTime()
      if (validationAge > TOKEN_VALIDATION_MAX_AGE_MS) {
        // Validation is stale - revalidate before creating job
        toast.info('Revalidando token DIAN...')
        setValidationPhase('validating')

        try {
          const result = await apiClient.quickValidateDianToken(dianToken, selectedEntity.id)

          if (result.valid) {
            setTokenValidatedAt(new Date())
            setValidationPhase('success')
            // Continue with job creation (don't return)
          } else {
            // Token is now invalid
            const errorCode = typeof result.error_code === 'string' ? result.error_code : undefined
            const errorMessage = getTokenErrorMessage(errorCode)
            setDianTokenError(errorMessage)
            setValidationPhase('error')
            setTokenValidatedAt(null)
            toast.error(errorMessage)
            dianTokenInputRef.current?.focus()
            return
          }
        } catch {
          setDianTokenError(getTokenErrorMessage('INTERNAL_ERROR'))
          setValidationPhase('error')
          toast.error('Error validando token DIAN')
          dianTokenInputRef.current?.focus()
          return
        }
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
    // Since we now validate and save tokens BEFORE job creation,
    // we always use 'use_stored_token' - the token is already in DB
    let tokenToSend: string
    if (isDevJob) {
      tokenToSend = ''
    } else {
      // Token was validated and saved during input validation
      // Auto-token, saved token, or manually entered token - all stored in DB
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
        },
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
    setTokenValidatedAt(null)
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
    setCreatedJobId(null)
    setIsDevJob(false)
    // Reset auto-token states
    setAutoTokenRequestId(null)
    setAutoTokenStatus('idle')
    setAutoTokenError(null)
    setAutoTokenStartedAt(null)
    // Clear timeouts
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    if (autoTokenPollingRef.current) {
      clearTimeout(autoTokenPollingRef.current)
    }
  }

  // Derived states from job options
  const autoTokenAvailable = jobOptions?.auto_management.available || false
  const autoTokenOAuthStatus = jobOptions?.auto_management.status || 'not_configured'
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
                  className={`w-full justify-between ${entitySelectorShake ? 'animate-shake ring-2 ring-red-500' : ''}`}
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
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nombre o identificador..." />
                  <CommandList className="max-h-[300px]">
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
          {selectedEntity && autoTokenOAuthStatus === 'oauth_expired' && (
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

          {selectedEntity && autoTokenOAuthStatus === 'oauth_pending' && (
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
          <div className="space-y-2">
            <Label htmlFor="dian-token">Token DIAN *</Label>

            {/* Auto-token request UI (when auto-token is being requested) */}
            {(autoTokenStatus === 'pending' || autoTokenStatus === 'polling') && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700">
                      {getAutoTokenElapsedMessage()}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      El token llegara automaticamente cuando DIAN responda
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-token received success */}
            {autoTokenStatus === 'received' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700">
                      Token DIAN recibido!
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      El token ha sido guardado y esta listo para usar
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-token failed/timeout */}
            {(autoTokenStatus === 'failed' || autoTokenStatus === 'timeout') && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">
                      {autoTokenError || 'No se pudo obtener el token'}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Puedes intentar de nuevo o pegar un token manualmente
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestAutoToken}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Reintentar
                  </Button>
                </div>
              </div>
            )}

            {/* Normal token input (when not requesting auto-token) */}
            {autoTokenStatus === 'idle' && (
              <>
                <div className="relative">
                  <Input
                    ref={dianTokenInputRef}
                    id="dian-token"
                    placeholder={
                      loadingJobOptions
                        ? 'Verificando opciones...'
                        : !useNewToken && savedTokenAvailable
                        ? `Usando token guardado (${tokenMasked || '****'})`
                        : 'https://catalogo-vpfe.dian.gov.co/...'
                    }
                    value={dianToken}
                    onChange={(e) => {
                      handleDianTokenChange(e.target.value)
                      // If user starts typing, disable stored token
                      if (e.target.value.trim()) {
                        if (!useNewToken && savedTokenAvailable) setUseNewToken(true)
                      }
                    }}
                    disabled={loadingJobOptions || (!useNewToken && savedTokenAvailable)}
                    className={`font-mono text-sm pr-10 ${
                      dianTokenError || validationPhase === 'error'
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : validationPhase === 'success' || validationPhase === 'success_sparkle' || (!useNewToken && savedTokenAvailable)
                        ? 'border-green-500 focus-visible:ring-green-500'
                        : ''
                    } ${(!useNewToken && savedTokenAvailable) ? 'bg-green-50/50' : ''} ${validationPhase === 'success_sparkle' ? 'bg-amber-50/50' : ''}`}
                  />
                  {/* Status indicator inside input */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {loadingJobOptions ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                        {selectedEntity ? 'Pega la URL del token DIAN o solicita uno automatico' : 'Pega la URL completa del token DIAN'}
                      </p>
                    )}
                  </div>

                  {/* Right: Options */}
                  {selectedEntity && !loadingJobOptions && (
                    <div className="flex items-center gap-3 ml-4">
                      {savedTokenAvailable && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={!useNewToken}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setUseNewToken(false)
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRequestAutoToken}
                          className="h-7 px-2 text-xs"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Solicitar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
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
                            // Always keep at least one category selected
                            setSelectedSheetTypes(checked ? ['ingresos', 'egresos', 'nominas'] : ['ingresos'])
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
                            disabled={selectedSheetTypes.length === 1 && selectedSheetTypes.includes(type.value)}
                            onCheckedChange={(checked) => {
                              if (!checked && selectedSheetTypes.length === 1) {
                                // Don't allow unchecking the last category
                                return
                              }
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

          {/* Dev Mode (staging only + dev role, not for pseudo entities) */}
          {isStaging && hasDevRole && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dev-job-mode"
                  checked={isDevJob}
                  onCheckedChange={(checked) => {
                    setIsDevJob(checked as boolean)
                    if (checked) {
                      setUseNewToken(false)
                      setDianToken('')
                      // Reset auto-token if in progress
                      setAutoTokenRequestId(null)
                      setAutoTokenStatus('idle')
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
                // Non-dev: need token
                (!isDevJob && (
                  // Auto-token in progress - wait for it to complete
                  (autoTokenStatus === 'pending' || autoTokenStatus === 'polling') ||
                  // No token available: need either auto-token received, saved token, or manual token
                  (autoTokenStatus !== 'received' && !savedTokenAvailable && !dianToken.trim()) ||
                  (autoTokenStatus !== 'received' && savedTokenAvailable && useNewToken && !dianToken.trim()) ||
                  // Manual token validation in progress
                  (validationPhase === 'validating' || validationPhase === 'verifying' || validationPhase === 'updating') ||
                  // Manual token has validation error
                  (!!dianToken.trim() && validationPhase === 'error')
                ))
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

// ============================================================================
// BATCH JOB CREATION
// ============================================================================

function BatchJobContent() {
  const router = useRouter()
  const { data: entitiesData } = useEntitiesSelector()

  const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | 'natural' | 'juridica'>('all')

  // Date selection - same logic as individual job form
  const [dateSelectionMode, setDateSelectionMode] = useState<'days' | 'months'>('months')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Categories - same as individual (all 3 selected by default)
  const [selectedSheetTypes, setSelectedSheetTypes] = useState<string[]>(['ingresos', 'egresos', 'nominas'])

  // Consolidation - same as individual
  const [consolidationValue, setConsolidationValue] = useState('1')
  const [consolidationUnit, setConsolidationUnit] = useState('months')
  const [useTotalConsolidation, setUseTotalConsolidation] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const batchMutation = useCreateBatchJobs()

  const entities = entitiesData?.entities || []
  const entityCount = entities.length

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecciona un rango de fechas')
      return
    }
    if (selectedSheetTypes.length === 0) {
      toast.error('Selecciona al menos una categoria')
      return
    }

    // Build consolidation interval (same logic as individual)
    let consolidationInterval: string | { value: number; unit: string }
    if (useTotalConsolidation) {
      consolidationInterval = 'total'
    } else {
      consolidationInterval = {
        value: parseInt(consolidationValue),
        unit: consolidationUnit
      }
    }

    setIsSubmitting(true)
    try {
      const result = await batchMutation.mutateAsync({
        entity_type_filter: entityTypeFilter,
        start_date: startDate,
        end_date: endDate,
        document_categories: selectedSheetTypes,
        consolidation_interval: consolidationInterval,
      })

      toast.success(
        `${result.created_count} trabajo${result.created_count !== 1 ? 's' : ''} creado${result.created_count !== 1 ? 's' : ''}` +
        (result.failed_count > 0 ? ` (${result.failed_count} fallido${result.failed_count !== 1 ? 's' : ''})` : '')
      )
      // Navigate to batch detail page
      if (result.batch_id) {
        router.push(`/trabajos/batch/${result.batch_id}`)
      } else {
        router.push('/trabajos')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creando trabajos en lote')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trabajos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Crear Trabajos en Lote</h1>
          <p className="text-muted-foreground">
            Crea trabajos para multiples entidades a la vez
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuracion del Lote</CardTitle>
          <CardDescription>
            Todos los trabajos se crearan en estado &quot;Esperando token&quot;.
            Luego puedes proporcionar el token DIAN individualmente desde la lista de trabajos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Type Filter */}
          <div className="space-y-2">
            <Label>Tipo de Entidad *</Label>
            <Select
              value={entityTypeFilter}
              onValueChange={(v) => setEntityTypeFilter(v as 'all' | 'natural' | 'juridica')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                <SelectItem value="natural">Solo personas naturales</SelectItem>
                <SelectItem value="juridica">Solo personas juridicas</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {entityCount} entidad{entityCount !== 1 ? 'es' : ''} registrada{entityCount !== 1 ? 's' : ''} en total
            </p>
          </div>

          {/* Date Range - same as individual job form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Periodo de Consulta *</Label>
              <div className="flex rounded-md overflow-hidden border">
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

            {dateSelectionMode === 'months' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="batch-start-month">Mes Inicial</Label>
                    <Input
                      id="batch-start-month"
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
                    <Label htmlFor="batch-end-month">Mes Final</Label>
                    <Input
                      id="batch-end-month"
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
                  <Label htmlFor="batch-start-date">Fecha Inicio</Label>
                  <Input
                    id="batch-start-date"
                    type="date"
                    value={startDate}
                    max={getColombiaToday()}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-end-date">Fecha Final</Label>
                  <Input
                    id="batch-end-date"
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

          {/* Document Categories - same table as individual */}
          <div className="space-y-2">
            <Label>Categorias de Documentos a Incluir *</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="batch-select-all-categories"
                          checked={selectedSheetTypes.length === 3}
                          onCheckedChange={(checked) => {
                            setSelectedSheetTypes(checked ? ['ingresos', 'egresos', 'nominas'] : ['ingresos'])
                          }}
                        />
                        <Label htmlFor="batch-select-all-categories" className="font-medium cursor-pointer">
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
                            id={`batch-category-${type.value}`}
                            checked={selectedSheetTypes.includes(type.value)}
                            disabled={selectedSheetTypes.length === 1 && selectedSheetTypes.includes(type.value)}
                            onCheckedChange={(checked) => {
                              if (!checked && selectedSheetTypes.length === 1) return
                              setSelectedSheetTypes(
                                checked
                                  ? [...selectedSheetTypes, type.value]
                                  : selectedSheetTypes.filter((t) => t !== type.value)
                              )
                            }}
                          />
                          <Label htmlFor={`batch-category-${type.value}`} className="text-sm font-normal cursor-pointer">
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

          {/* Consolidation Interval - same as individual */}
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
                id="batch-use-total-consolidation"
                checked={useTotalConsolidation}
                onCheckedChange={(checked) => setUseTotalConsolidation(checked as boolean)}
              />
              <Label htmlFor="batch-use-total-consolidation" className="text-sm font-normal cursor-pointer">
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
              disabled={isSubmitting || selectedSheetTypes.length === 0 || !startDate || !endDate}
              className="flex-1 gap-2"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando trabajos...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Crear Trabajos en Lote
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
      <NewJobPageInner />
    </Suspense>
  )
}

function NewJobPageInner() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode')
  const [mode, setMode] = useState<'choose' | 'single' | 'batch'>(
    initialMode === 'batch' ? 'batch' : initialMode === 'single' ? 'single' : 'choose'
  )

  if (mode === 'single') {
    return <NewJobContent />
  }

  if (mode === 'batch') {
    return <BatchJobContent />
  }

  // Mode selection screen
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/trabajos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Trabajo</h1>
          <p className="text-muted-foreground">
            Selecciona como quieres crear los trabajos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setMode('single')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Job Individual</CardTitle>
                <CardDescription>
                  Un trabajo para una entidad
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Selecciona una entidad, proporciona el token DIAN y configura el rango de fechas.
              El trabajo se lanza inmediatamente.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setMode('batch')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Jobs en Lote</CardTitle>
                <CardDescription>
                  Multiples trabajos a la vez
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Crea trabajos para todas tus entidades (o filtradas por tipo).
              Luego proporciona el token DIAN de cada una desde la lista.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
