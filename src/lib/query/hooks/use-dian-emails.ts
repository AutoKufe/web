'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'
import { staleTime, gcTime } from '../config'

/**
 * DIAN Email interface matching backend response
 */
export interface DianEmail {
  id: string
  email_masked: string
  auth_status: 'active' | 'pending' | 'expired' | 'revoked' | 'inactive' | 'failed'
  authorized_at?: string | null
  deactivated_at?: string | null
  failed_at?: string | null
  expired_at?: string | null
  updated_at?: string
  created_at: string
  associated_entities_count: number
}

interface DianEmailsSyncResponse {
  status: string
  sync_mode: string
  changes: {
    modified_or_added: DianEmail[]
    all_valid_prefixes: string[]
    count: number
  }
  total_count: number
}

interface DianEmailsData {
  emails: DianEmail[]
  totalCount: number
}

/**
 * Fetch all DIAN emails for the current user
 *
 * Returns cached data instantly, then refetches in background.
 */
export function useDianEmails() {
  return useQuery<DianEmailsData>({
    queryKey: queryKeys.dianEmails.list(),
    queryFn: async () => {
      // Use syncDianEmails for full fetch (no cached prefixes = full sync)
      const response = await apiClient.syncDianEmails()

      if (response.error) {
        throw new Error(response.message || 'Error fetching DIAN emails')
      }

      const data = response as unknown as DianEmailsSyncResponse
      const emails = data.changes?.modified_or_added || []

      return {
        emails,
        totalCount: data.total_count || emails.length,
      }
    },
    staleTime: staleTime.dianEmails,
    gcTime: gcTime.dianEmails,
  })
}

/**
 * Get a DIAN email from the cached list
 *
 * Useful for lookups in entity displays without additional API calls.
 * Returns null if email not found in cache.
 */
export function useDianEmailFromList(dianEmailId: string | null | undefined): DianEmail | null {
  const queryClient = useQueryClient()

  if (!dianEmailId) {
    return null
  }

  const cache = queryClient.getQueryData<DianEmailsData>(queryKeys.dianEmails.list())
  if (!cache?.emails) {
    return null
  }

  return cache.emails.find((email) => email.id === dianEmailId) || null
}

/**
 * Hook version of useDianEmailFromList that subscribes to updates
 *
 * Use this in components that need to re-render when the email data changes.
 */
export function useDianEmailLookup(dianEmailId: string | null | undefined) {
  const { data } = useDianEmails()

  if (!dianEmailId || !data?.emails) {
    return null
  }

  return data.emails.find((email) => email.id === dianEmailId) || null
}

/**
 * Get a single DIAN email by ID (with full details)
 *
 * Use this for detail views that need additional data like oauth_url.
 */
export function useDianEmail(dianEmailId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dianEmails.detail(dianEmailId!),
    queryFn: async () => {
      const response = await apiClient.getDianEmailDetails(dianEmailId!)

      if (response.error) {
        throw new Error(response.message || 'Error fetching DIAN email details')
      }

      return response as {
        id: string
        email: string
        status: string
        requested_at: string
        authorized_at?: string
        deactivated_at?: string
        has_filter: boolean
        oauth_url?: string
        associated_entities?: Array<{
          id: string
          display_name: string
          identifier_suffix: string
        }>
      }
    },
    enabled: !!dianEmailId,
    staleTime: staleTime.dianEmails,
    gcTime: gcTime.dianEmails,
  })
}
