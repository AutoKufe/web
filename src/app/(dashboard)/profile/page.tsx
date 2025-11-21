'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Mail,
  Calendar,
  CreditCard,
  TrendingUp,
  Shield,
  LogOut,
  ArrowUpRight
} from 'lucide-react'
import { toast } from 'sonner'

interface SubscriptionData {
  plan: string
  docs_limit: number
  docs_used: number
  period_start: string
  period_end: string
  status: string
}

interface UserProfile {
  id: string
  email: string
  created_at: string
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading, signOut } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (authLoading || !authUser) return

    const fetchData = async () => {
      try {
        const subResponse = await apiClient.getSubscription()
        if (subResponse && !subResponse.error) {
          setSubscription(subResponse as unknown as SubscriptionData)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
        toast.error('Error cargando perfil')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authLoading, authUser])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const getPlanBadgeVariant = (plan: string): 'default' | 'secondary' | 'outline' => {
    switch (plan) {
      case 'business':
      case 'enterprise':
        return 'default'
      case 'pro':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const usagePercentage = subscription
    ? Math.round((subscription.docs_used / subscription.docs_limit) * 100)
    : 0

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-48 bg-muted rounded" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Perfil</h1>
        <p className="text-muted-foreground">
          Gestiona tu cuenta y suscripción
        </p>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información de Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
              {authUser?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-medium text-lg">{authUser?.email}</p>
              <p className="text-sm text-muted-foreground">
                ID: {authUser?.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{authUser?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Miembro desde</p>
                <p className="text-sm font-medium">
                  N/A
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Suscripción
            </CardTitle>
            {subscription && (
              <Badge variant={getPlanBadgeVariant(subscription.plan)}>
                Plan {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
              </Badge>
            )}
          </div>
          <CardDescription>
            Tu plan actual y uso de documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription ? (
            <>
              {/* Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Uso este mes</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {subscription.docs_used.toLocaleString()} / {subscription.docs_limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      usagePercentage >= 90
                        ? 'bg-destructive'
                        : usagePercentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {usagePercentage}% utilizado • {(subscription.docs_limit - subscription.docs_used).toLocaleString()} documentos restantes
                </p>
              </div>

              <Separator />

              {/* Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Período actual</p>
                  <p className="text-sm font-medium">
                    {new Date(subscription.period_start).toLocaleDateString()} -{' '}
                    {new Date(subscription.period_end).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Se renueva en</p>
                  <p className="text-sm font-medium">
                    {Math.ceil(
                      (new Date(subscription.period_end).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )}{' '}
                    días
                  </p>
                </div>
              </div>

              {/* Upgrade Button */}
              {subscription.plan !== 'business' && (
                <Button className="w-full gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Upgrade de Plan
                </Button>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                No tienes una suscripción activa
              </p>
              <Button>Ver Planes</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Mail className="h-4 w-4" />
            Cambiar contraseña
          </Button>
          <Separator />
          <Button
            variant="destructive"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
