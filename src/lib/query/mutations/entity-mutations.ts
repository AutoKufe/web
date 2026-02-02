'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'

/**
 * Register a new entity with DIAN token
 */
export function useRegisterEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dianToken: string) => {
      const response = await apiClient.registerEntity(dianToken)

      if (response.error) {
        throw new Error(response.message || 'Error registering entity')
      }

      return response
    },
    onSuccess: () => {
      // New entity: invalidate both full list AND selector
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.selector() })
    },
  })
}

/**
 * Delete an entity
 */
export function useDeleteEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entityId: string) => {
      const response = await apiClient.deleteEntity(entityId)

      if (response.error) {
        throw new Error(response.message || 'Error deleting entity')
      }

      return response
    },
    onSuccess: (_, entityId) => {
      // Entity removed: invalidate both full list AND selector
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.selector() })
      // Remove specific entity from cache
      queryClient.removeQueries({ queryKey: queryKeys.entities.detail(entityId) })
    },
  })
}

/**
 * Cleanup entity storage (staging only, dev role required)
 */
export function useCleanupEntityStorage() {
  return useMutation({
    mutationFn: async (entityId: string) => {
      const response = await apiClient.cleanupEntityStorage(entityId)

      if (response.error) {
        throw new Error(response.message || 'Error cleaning up storage')
      }

      return response as {
        success: boolean
        files_deleted: number
        space_freed_mb: number
        entity_name?: string
      }
    },
  })
}
