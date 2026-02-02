'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'
import { staleTime, gcTime } from '../config'

/**
 * Full entity interface (all fields from backend)
 */
export interface Entity {
  id: string
  display_name: string
  identifier_suffix: string
  entity_type: string
  created_at: string
  updated_at?: string
  dian_email_id?: string | null
}

/**
 * Minimal entity for selectors (only display fields)
 */
export interface EntitySelectorItem {
  id: string
  display_name: string
  identifier_suffix: string
}

interface EntitiesResponse {
  entities: Entity[]
  pagination: {
    total_count: number
    page_size: number
    total_pages: number
    page: number
  }
  sync_timestamp?: string
}

interface EntitiesData {
  entities: Entity[]
  totalCount: number
}

/**
 * Base query options for entities list
 * Shared between useEntities and useEntitiesSelector
 */
const entitiesQueryOptions = {
  queryKey: queryKeys.entities.list(),
  queryFn: async (): Promise<EntitiesData> => {
    const response = await apiClient.listEntities(1, 9999)

    if (response.error) {
      throw new Error(response.message || 'Error fetching entities')
    }

    const data = response as unknown as EntitiesResponse
    return {
      entities: data.entities || [],
      totalCount: data.pagination?.total_count || 0,
    }
  },
  staleTime: staleTime.entities,
  gcTime: gcTime.entities,
}

/**
 * Fetch all entities with full data
 *
 * Use this for pages that need all entity fields (e.g., /entidades table)
 */
export function useEntities() {
  return useQuery(entitiesQueryOptions)
}

/**
 * Selector response from /entities/selector endpoint
 */
interface SelectorResponse {
  status: string
  sync_mode: string
  changes: {
    modified_or_added: EntitySelectorItem[]
    all_valid_prefixes: string[]
    count: number
  }
  total_count: number
  sync_timestamp: string
}

interface SelectorData {
  entities: EntitySelectorItem[]
  totalCount: number
}

/**
 * Get entities for selector (minimal fields)
 *
 * Uses a SEPARATE endpoint and query key from useEntities.
 * Only invalidated when display_name or identifier_suffix change in DB
 * (uses selector_updated_at timestamp).
 *
 * This provides true cache granularity:
 * - Changing dian_email_id does NOT invalidate selector cache
 * - Only display_name/identifier_suffix changes trigger refetch
 *
 * Use this for entity dropdowns/selectors that only need id + display_name + suffix
 */
export function useEntitiesSelector() {
  return useQuery<SelectorData>({
    queryKey: queryKeys.entities.selector(),
    queryFn: async () => {
      const response = await apiClient.listEntitiesSelector()

      if (response.error) {
        throw new Error(response.message || 'Error fetching entities selector')
      }

      const data = response as unknown as SelectorResponse
      return {
        entities: data.changes?.modified_or_added || [],
        totalCount: data.total_count || 0,
      }
    },
    staleTime: staleTime.entities,
    gcTime: gcTime.entities,
  })
}

/**
 * Get a single entity from the cached list
 *
 * Useful for lookups without additional API calls.
 * Returns null if entity not found in cache.
 */
export function useEntityFromList(entityId: string | null | undefined) {
  const { data } = useEntities()

  if (!entityId || !data?.entities) {
    return null
  }

  return data.entities.find((e) => e.id === entityId) || null
}

/**
 * Hook to get entity by ID from cache (for components that need entity data)
 *
 * First checks the list cache, then falls back to individual fetch.
 * This prevents unnecessary API calls when entity is already cached.
 */
export function useEntity(entityId: string | undefined) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.entities.detail(entityId!),
    queryFn: async () => {
      // First, try to get from list cache
      const listCache = queryClient.getQueryData<EntitiesData>(queryKeys.entities.list())
      if (listCache) {
        const cachedEntity = listCache.entities.find((e) => e.id === entityId)
        if (cachedEntity) {
          return {
            ...cachedEntity,
            identifier: `****${cachedEntity.identifier_suffix}`,
          }
        }
      }

      // Not in cache, fetch from API
      const response = (await apiClient.getEntity(entityId!)) as {
        error?: string
        message?: string
        entity?: {
          id: string
          name: string
          display_name: string
          identifier: string
          type_code: string
          created_at: string
          updated_at?: string
          dian_email_id?: string | null
        }
      }

      if (response.error) {
        throw new Error(response.message || 'Error fetching entity')
      }

      const entity = response.entity
      if (!entity) {
        throw new Error('Entity not found')
      }

      return {
        id: entity.id,
        display_name: entity.display_name || entity.name,
        identifier: entity.identifier,
        identifier_suffix: entity.identifier?.slice(-4) || '',
        entity_type: entity.type_code,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
        dian_email_id: entity.dian_email_id,
      }
    },
    enabled: !!entityId,
    staleTime: staleTime.entities,
    gcTime: gcTime.entities,
  })
}

/**
 * Search entities by name or identifier
 *
 * Note: This uses a separate query key because search results
 * may differ from the full list.
 */
export function useSearchEntities(params: {
  name?: string
  last_digits?: string
  entity_type?: string
  enabled?: boolean
}) {
  const { name, last_digits, entity_type, enabled = true } = params

  return useQuery({
    queryKey: queryKeys.entities.list({ search: name || last_digits }),
    queryFn: async () => {
      const response = (await apiClient.searchEntities({
        name,
        last_digits,
        entity_type,
        page_size: 20,
      })) as { error?: string; message?: string; entities?: Entity[] }

      if (response.error) {
        throw new Error(response.message || 'Error searching entities')
      }

      return {
        entities: response.entities || [],
        totalCount: response.entities?.length || 0,
      }
    },
    enabled: enabled && !!(name || last_digits),
    staleTime: staleTime.entities,
  })
}

/**
 * Get entity token status
 */
export function useEntityTokenStatus(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.entities.tokenStatus(entityId!),
    queryFn: async () => {
      const response = await apiClient.getEntityTokenStatus(entityId!)

      if (response.error) {
        throw new Error(response.message || 'Error fetching token status')
      }

      return response
    },
    enabled: !!entityId,
    staleTime: staleTime.tokenStatus,
  })
}

/**
 * Get entity auto token status
 */
export function useEntityAutoTokenStatus(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.entities.autoTokenStatus(entityId!),
    queryFn: async () => {
      const response = await apiClient.getEntityAutoTokenStatus(entityId!)

      if (response.error) {
        throw new Error(response.message || 'Error fetching auto token status')
      }

      return response
    },
    enabled: !!entityId,
    staleTime: staleTime.autoTokenStatus,
  })
}

/**
 * Get job creation options for an entity
 *
 * Returns token availability, auto-management status, and recommended option.
 */
export function useEntityJobCreationOptions(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.entities.jobCreationOptions(entityId!),
    queryFn: async () => {
      const response = await apiClient.getEntityJobCreationOptions(entityId!)

      if (response.error) {
        throw new Error(response.message || 'Error fetching job creation options')
      }

      return response as {
        auto_management: {
          available: boolean
          status: string
          message: string
          dian_email_masked?: string
          should_be_default: boolean
        }
        saved_token: {
          available: boolean
          token_masked?: string
          should_be_default: boolean
        }
        manual_token: {
          available: boolean
          should_be_default: boolean
        }
        recommended_option: 'auto' | 'saved' | 'manual'
      }
    },
    enabled: !!entityId,
    staleTime: staleTime.jobCreationOptions,
  })
}
