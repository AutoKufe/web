'use client'

import { useEffect, useState, use } from 'react'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Loader2, AlertCircle } from 'lucide-react'
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
      if (authLoading) return

      if (!user) {
        setError('Debes iniciar sesión para ver este PDF')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const token = (apiClient as any).accessToken

        if (!token) {
          setError('No se encontró token de autenticación')
          setLoading(false)
          return
        }

        const response = await fetch(`https://api.autokufe.com/pdf/${doc_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

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

        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)

        setPdfUrl(blobUrl)
        setLoading(false)
      } catch (err) {
        setError('Error de conexión al cargar el PDF')
        setLoading(false)
      }
    }

    fetchPDF()

    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [doc_id, user, authLoading])

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
    <div className="min-h-screen">
      {pdfUrl && (
        <iframe
          src={pdfUrl}
          className="w-full h-screen"
          title="PDF Viewer"
        />
      )}
    </div>
  )
}
