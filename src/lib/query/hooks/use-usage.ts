'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'
import { staleTime, gcTime } from '../config'

/**
 * Usage data interface
 */
export interface UsageData {
  docs_used: number
  docs_limit: number
  plan: string
  period_end: string
}

/**
 * Subscription data interface
 */
export interface SubscriptionData {
  plan: string
  status: string
  docs_limit: number
  period_start: string
  period_end: string
  stripe_subscription_id?: string
}

/**
 * Fetch current usage statistics
 */
export function useUsage() {
  return useQuery({
    queryKey: queryKeys.usage,
    queryFn: async () => {
      const response = await apiClient.getUsage()

      if (response.error) {
        throw new Error(response.message || 'Error fetching usage')
      }

      return response as unknown as UsageData
    },
    staleTime: staleTime.usage,
    gcTime: gcTime.usage,
  })
}

/**
 * Fetch subscription details
 */
export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: async () => {
      const response = await apiClient.getSubscription()

      if (response.error) {
        throw new Error(response.message || 'Error fetching subscription')
      }

      return response as unknown as SubscriptionData
    },
    staleTime: staleTime.subscription,
    gcTime: gcTime.subscription,
  })
}

/**
 * Fetch available plans
 */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: async () => {
      const response = await apiClient.getPlans()

      if (response.error) {
        throw new Error(response.message || 'Error fetching plans')
      }

      return response as unknown as {
        plans: Array<{
          id: string
          name: string
          docs_limit: number
          price: number
          features: string[]
        }>
      }
    },
    staleTime: staleTime.plans,
    gcTime: gcTime.plans,
  })
}

/**
 * Check if user can download documents
 */
export function useCanDownload(docCount = 1, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.usage, 'can-download', docCount],
    queryFn: async () => {
      const response = await apiClient.canDownload(docCount)

      if (response.error) {
        return { can_download: false, reason: response.message }
      }

      return response as unknown as {
        can_download: boolean
        docs_remaining?: number
        reason?: string
      }
    },
    enabled,
    staleTime: staleTime.usage,
  })
}
