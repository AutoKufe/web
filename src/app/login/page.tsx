'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const messages: Record<string, string> = {
        'Invalid login credentials': 'Correo o contraseña incorrectos',
        'Email not confirmed': 'Debes confirmar tu correo electrónico',
        'Too many requests': 'Demasiados intentos. Intenta de nuevo más tarde',
      }
      setError(messages[error.message] || error.message)
      setLoading(false)
      return
    }

    // STAGING SECURITY: Verify dev role before allowing session to persist
    const hostname = window.location.hostname
    const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'production'
    const isStagingDomain = hostname.includes('dev.autokufe.com')

    if (isStagingDomain || environment === 'staging') {
      // User successfully authenticated, but we need to verify they have dev access
      const userId = data.user?.id

      if (userId) {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .is('revoked_at', null)

        const userRoles = roles?.map(r => r.role) || []
        const hasDevAccess = userRoles.includes('dev') || userRoles.includes('super_admin')

        if (!hasDevAccess) {
          // User doesn't have dev role - sign them out immediately
          await supabase.auth.signOut()
          setError('El ambiente de staging está reservado para desarrolladores. Si necesitas acceso, contacta al equipo de desarrollo.')
          setLoading(false)
          return
        }
      }
    }

    // Redirect based on domain
    const isAdminDomain = hostname.includes('admin.')
    router.push(isAdminDomain ? '/support' : '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">AutoKufe</CardTitle>
          <CardDescription className="text-center">
            Ingresa tus credenciales para acceder
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Regístrate
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
