import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileText, Zap, Shield, Clock } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">AutoKufe</span>
          </div>
          <Link href="https://app.autokufe.com/login">
            <Button variant="outline">Iniciar Sesion</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Automatiza tu{' '}
            <span className="text-primary">facturacion DIAN</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descarga, procesa y genera reportes de tus documentos electronicos DIAN
            de forma automatica. Ahorra horas de trabajo manual.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="https://app.autokufe.com/register">
              <Button size="lg" className="w-full sm:w-auto">
                <Zap className="mr-2 h-5 w-5" />
                Comenzar Gratis
              </Button>
            </Link>
            <Link href="https://app.autokufe.com/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="bg-card rounded-xl p-6 border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Automatico</h3>
            <p className="text-muted-foreground">
              Solo ingresa tu token DIAN y nosotros hacemos el resto.
              Descarga automatica de todos tus documentos.
            </p>
          </div>
          <div className="bg-card rounded-xl p-6 border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ahorra Tiempo</h3>
            <p className="text-muted-foreground">
              Procesa meses de documentos en minutos.
              Genera reportes Excel listos para contabilidad.
            </p>
          </div>
          <div className="bg-card rounded-xl p-6 border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Seguro</h3>
            <p className="text-muted-foreground">
              Tus datos encriptados en todo momento.
              No almacenamos credenciales DIAN.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            2024 AutoKufe. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terminos
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacidad
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
