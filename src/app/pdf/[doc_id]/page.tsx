'use client'

import { useEffect, useState, use } from 'react'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Loader2, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function PDFViewerPage({ params }: { params: Promise<{ doc_id: string }> }) {
  const { doc_id } = use(params)
  const { user, loading: authLoading } = useAuth()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPDF = async () => {
      console.log('[PDFViewer] Starting fetch, authLoading:', authLoading, 'user:', user)

      if (authLoading) {
        console.log('[PDFViewer] Still loading auth, waiting...')
        return
      }

      if (!user) {
        console.log('[PDFViewer] No user found')
        setError('Debes iniciar sesión para ver este PDF')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const token = localStorage.getItem('access_token')
        console.log('[PDFViewer] Token found:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN')

        if (!token) {
          setError('No se encontró token de autenticación')
          setLoading(false)
          return
        }

        const apiUrl = `https://api.autokufe.com/pdf/${doc_id}`
        console.log('[PDFViewer] Fetching PDF from:', apiUrl)

        // Fetch PDF from backend
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        console.log('[PDFViewer] Response status:', response.status)

        if (!response.ok) {
          if (response.status === 404) {
            setError('PDF no encontrado')
          } else if (response.status === 403) {
            setError('No tienes permiso para ver este PDF')
          } else {
            setError('Error al cargar el PDF')
          }
          setLoading(false)
          return
        }

        // Create blob URL for PDF
        const blob = await response.blob()
        console.log('[PDFViewer] Blob created, size:', blob.size, 'type:', blob.type)

        const blobUrl = window.URL.createObjectURL(blob)
        console.log('[PDFViewer] Object URL created:', blobUrl)

        setPdfUrl(blobUrl)
        setLoading(false)
        console.log('[PDFViewer] PDF loaded successfully')
      } catch (err) {
        console.error('[PDFViewer] Error loading PDF:', err)
        setError('Error de conexión al cargar el PDF')
        setLoading(false)
      }
    }

    console.log('[PDFViewer] useEffect triggered, calling fetchPDF()')
    fetchPDF()

    // Cleanup blob URL on unmount
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [doc_id, user, authLoading])

  const handleDownload = () => {
    if (!pdfUrl) return

    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `${doc_id}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.close()}>Cerrar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with download button */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Visualizador de PDF</h1>
          <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-gray-100">
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            style={{ minHeight: 'calc(100vh - 60px)' }}
            title="PDF Viewer"
          />
        )}
      </div>
    </div>
  )
}
