/**
 * Role Management Utilities
 *
 * Sistema de roles para personal interno de AutoKufe.
 * Usuarios SIN rol = usuario normal
 * Usuarios CON rol = admin/soporte/técnico
 */

import { createBrowserClient } from '@supabase/ssr'

export type AdminRole = 'super_admin' | 'technical_support' | 'support_agent'

export interface UserRole {
  id: string
  user_id: string
  role: AdminRole
  granted_at: string
  granted_by: string | null
  revoked_at: string | null
}

/**
 * Obtener roles activos de un usuario
 */
export async function getUserRoles(userId: string): Promise<AdminRole[]> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error) {
    console.error('Error fetching user roles:', error)
    return []
  }

  return data?.map(r => r.role as AdminRole) || []
}

/**
 * Verificar si usuario tiene algún rol de admin
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roles.length > 0
}

/**
 * Verificar si usuario tiene acceso a panel admin
 */
export function hasAdminAccess(roles: AdminRole[]): boolean {
  return roles.length > 0
}

/**
 * Verificar si puede resolver jobs (marcar como resolved)
 */
export function canResolveJobs(roles: AdminRole[]): boolean {
  return roles.some(r => ['super_admin', 'technical_support'].includes(r))
}

/**
 * Verificar si puede reportar errores
 */
export function canReportErrors(roles: AdminRole[]): boolean {
  return roles.some(r => ['super_admin', 'technical_support', 'support_agent'].includes(r))
}

/**
 * Verificar si puede gestionar usuarios y roles
 */
export function canManageUsers(roles: AdminRole[]): boolean {
  return roles.includes('super_admin')
}

/**
 * Verificar si puede ver logs técnicos
 */
export function canViewTechnicalLogs(roles: AdminRole[]): boolean {
  return roles.some(r => ['super_admin', 'technical_support'].includes(r))
}

/**
 * Obtener nombre legible del rol
 */
export function getRoleLabel(role: AdminRole): string {
  const labels: Record<AdminRole, string> = {
    'super_admin': 'Super Admin',
    'technical_support': 'Soporte Técnico',
    'support_agent': 'Agente de Soporte'
  }
  return labels[role] || role
}

/**
 * Obtener descripción del rol
 */
export function getRoleDescription(role: AdminRole): string {
  const descriptions: Record<AdminRole, string> = {
    'super_admin': 'Acceso completo a todas las funcionalidades',
    'technical_support': 'Puede resolver errores técnicos y ver logs',
    'support_agent': 'Puede reportar errores de usuarios'
  }
  return descriptions[role] || ''
}
