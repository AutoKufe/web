/**
 * useUserRoles Hook
 *
 * Hook para obtener y gestionar roles del usuario actual
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getUserRoles, type AdminRole } from '@/lib/auth/roles'

export function useUserRoles() {
  const { user, loading: authLoading } = useAuth()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function fetchRoles() {
      if (authLoading || !user) {
        setLoading(false)
        return
      }

      try {
        const userRoles = await getUserRoles(user.id)
        setRoles(userRoles)
        setIsAdmin(userRoles.length > 0)
      } catch (error) {
        console.error('Error fetching user roles:', error)
        setRoles([])
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    fetchRoles()
  }, [user, authLoading])

  return {
    roles,
    loading,
    isAdmin,
    isSuperAdmin: roles.includes('super_admin'),
    isTechnicalSupport: roles.includes('technical_support'),
    isSupportAgent: roles.includes('support_agent')
  }
}
