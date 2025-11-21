'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'

function NewJobContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedEntity = searchParams.get('entity')

  const [dianToken, setDianToken] = useState('')
  const [jobName, setJobName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [consolidationInterval, setConsolidationInterval] = useState('monthly')
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState<'form' | 'confirming' | 'success'>('form')
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [entityInfo, setEntityInfo] = useState<{ name: string; nit: string } | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)

  const handleSubmit = async (confirmEntity = false) => {
    if (!dianToken.trim()) {
      toast.error('Ingresa el token DIAN')
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

    setCreating(true)

    try {
      const response = await apiClient.createJobWithToken(
        dianToken,
        {
          date_range: {
            start_date: startDate,
            end_date: endDate,
          },
          document_filter: documentFilter,
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
    setDocumentFilter('all')
    setConsolidationInterval('monthly')
    setEntityInfo(null)
    setTraceId(null)
    setCreatedJobId(null)
  }

  if (step === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Job Creado Exitosamente</h2>
              <p className="text-muted-foreground mb-6">
                Tu job ha sido enviado para procesamiento
              </p>
              <div className="flex gap-4 justify-center">
                <Link href={`/jobs/${createdJobId}`}>
                  <Button>Ver Estado del Job</Button>
                </Link>
                <Button variant="outline" onClick={resetForm}>
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
      <div className="max-w-2xl mx-auto">
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
                  <p className="text-sm text-muted-foreground">NIT</p>
                  <p className="font-mono">{entityInfo?.nit}</p>
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jobs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Job</h1>
          <p className="text-muted-foreground">
            Crea un nuevo trabajo de procesamiento DIAN
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración del Job</CardTitle>
          <CardDescription>
            Ingresa los datos necesarios para procesar documentos DIAN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token DIAN */}
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

          {/* Nombre del Job (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="job-name">Nombre del Job (opcional)</Label>
            <Input
              id="job-name"
              placeholder="Ej: Facturas Enero 2024"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
            />
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
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Filtros */}
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="advanced">Avanzado</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Tipo de Documentos</Label>
                <Select value={documentFilter} onValueChange={setDocumentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los documentos</SelectItem>
                    <SelectItem value="received">Solo recibidos</SelectItem>
                    <SelectItem value="sent">Solo emitidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Tipo de Documentos</Label>
                <Select value={documentFilter} onValueChange={setDocumentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los documentos</SelectItem>
                    <SelectItem value="received">Solo recibidos</SelectItem>
                    <SelectItem value="sent">Solo emitidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Intervalo de Consolidación</Label>
                <Select
                  value={consolidationInterval}
                  onValueChange={setConsolidationInterval}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona intervalo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define cómo se agrupan los documentos en el reporte
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <Link href="/jobs" className="flex-1">
              <Button variant="outline" className="w-full">
                Cancelar
              </Button>
            </Link>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={creating || !dianToken.trim() || !startDate || !endDate}
              className="flex-1"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
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
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    }>
      <NewJobContent />
    </Suspense>
  )
}
