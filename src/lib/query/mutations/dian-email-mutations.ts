'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'

/**
 * Register a new DIAN email
 */
export function useRegisterDianEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dianEmail: string) => {
      const response = await apiClient.registerDianEmail(dianEmail)

      if (response.error) {
        throw new Error(response.message || 'Error registering DIAN email')
      }

      return response as {
        success: boolean
        dian_email_id: string
        oauth_url: string
        message: string
      }
    },
    onSuccess: () => {
      // Invalidate DIAN emails list
      queryClient.invalidateQueries({ queryKey: queryKeys.dianEmails.all })
    },
  })
}

/**
 * Deactivate a DIAN email
 */
export function useDeactivateDianEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dianEmailId: string) => {
      const response = await apiClient.deactivateDianEmail(dianEmailId)

      if (response.error) {
        throw new Error(response.message || 'Error deactivating DIAN email')
      }

      return response
    },
    onSuccess: (_, dianEmailId) => {
      // Invalidate DIAN emails list
      queryClient.invalidateQueries({ queryKey: queryKeys.dianEmails.all })
      // Invalidate specific email
      queryClient.invalidateQueries({ queryKey: queryKeys.dianEmails.detail(dianEmailId) })
      // Invalidate entities (may affect auto token status)
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })
}

/**
 * Reactivate a DIAN email
 */
export function useReactivateDianEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dianEmailId: string) => {
      const response = await apiClient.reactivateDianEmail(dianEmailId)

      if (response.error) {
        throw new Error(response.message || 'Error reactivating DIAN email')
      }

      return response
    },
    onSuccess: (_, dianEmailId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dianEmails.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dianEmails.detail(dianEmailId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })
}

/**
 * Regenerate OAuth URL for a DIAN email
 */
export function useRegenerateOAuthUrl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dianEmailId: string) => {
      const response = await apiClient.regenerateOAuthUrl(dianEmailId)

      if (response.error) {
        throw new Error(response.message || 'Error regenerating OAuth URL')
      }

      return response as {
        success: boolean
        oauth_url: string
        message: string
      }
    },
    onSuccess: (_, dianEmailId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dianEmails.detail(dianEmailId) })
    },
  })
}
