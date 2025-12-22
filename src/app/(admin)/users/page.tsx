'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRoles } from '@/lib/hooks/use-user-roles'
import { canManageUsers } from '@/lib/auth/roles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function AdminUsersPage() {
  const router = useRouter()
  const { roles, loading, isSuperAdmin } = useUserRoles()

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      // Only super_admin can access this page
      router.push('/support')
    }
  }, [isSuperAdmin, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        <p className="text-gray-600 mt-2">
          Administración de usuarios y roles (solo super_admin)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Sistema</CardTitle>
          <CardDescription>
            Próximamente: Gestión de usuarios, asignación de roles, y auditoría
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Funcionalidad en desarrollo</p>
            <p className="text-sm text-gray-500 mt-2">
              Aquí podrás:
            </p>
            <ul className="text-sm text-gray-500 mt-4 space-y-2">
              <li>• Ver todos los usuarios registrados</li>
              <li>• Asignar y revocar roles de admin</li>
              <li>• Ver historial de auditoría</li>
              <li>• Gestionar permisos especiales</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
