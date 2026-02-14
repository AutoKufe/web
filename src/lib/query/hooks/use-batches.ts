'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'
import { staleTime, gcTime, refetchInterval, ACTIVE_JOB_STATUSES } from '../config'

/**
 * Batch interface matching backend response
 */
export interface JobBatch {
  id: string
  entity_type_filter: string
  start_date: string
  end_date: string
  document_categories: string[]
  consolidation_interval: string
  total_jobs: number
  completed_jobs: number
  failed_jobs: number
  processing_jobs: number
  queued_jobs: number
  waiting_token_jobs: number
  created_at: string
}

/**
 * Job within a batch
 */
export interface BatchJob {
  id: string
  job_name: string
  entity_id: string
  status: string
  start_date: string
  end_date: string
  total_documents: number
  processed_documents: number
  error_message: string | null
  error_code: string | null
  created_at: string
  completed_at: string | null
  progress_percentage: number
  stage: string
}

interface BatchesQueryResult {
  batches: JobBatch[]
  totalCount: number
  totalPages: number
  hasActiveBatches: boolean
}

interface BatchDetailResult {
  batch: JobBatch
  jobs: BatchJob[]
  hasActiveJobs: boolean
}

/**
 * Fetch paginated batches list with auto-polling when active batches exist
 */
export function useBatchesWithPolling(page = 1, pageSize = 20) {
  return useQuery<BatchesQueryResult>({
    queryKey: queryKeys.batches.list(page),
    queryFn: async () => {
      const response = await apiClient.listBatches(page, pageSize)

      if (response.error) {
        throw new Error(response.message || 'Error fetching batches')
      }

      const data = response as unknown as {
        batches: JobBatch[]
        total_count: number
        per_page: number
      }

      const batches = data.batches || []
      const hasActiveBatches = batches.some(
        (b) => b.processing_jobs > 0 || b.queued_jobs > 0 || b.waiting_token_jobs > 0
      )

      return {
        batches,
        totalCount: data.total_count || 0,
        totalPages: Math.ceil((data.total_count || 0) / (data.per_page || pageSize)),
        hasActiveBatches,
      }
    },
    staleTime: staleTime.jobs,
    gcTime: gcTime.jobs,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.hasActiveBatches) {
        return refetchInterval.jobsListWithActive
      }
      return false
    },
  })
}

/**
 * Fetch batch detail with all child jobs and auto-polling
 */
export function useBatchDetail(batchId: string | undefined) {
  return useQuery<BatchDetailResult>({
    queryKey: queryKeys.batches.detail(batchId!),
    queryFn: async () => {
      const response = await apiClient.getBatchDetail(batchId!)

      if (response.error) {
        throw new Error(response.message || 'Error fetching batch')
      }

      const data = response as unknown as {
        batch: JobBatch
        jobs: BatchJob[]
      }

      if (!data.batch) {
        throw new Error('Batch not found')
      }

      const hasActiveJobs = (data.jobs || []).some((j) =>
        ACTIVE_JOB_STATUSES.includes(j.status)
      )

      return {
        batch: data.batch,
        jobs: data.jobs || [],
        hasActiveJobs,
      }
    },
    enabled: !!batchId,
    staleTime: staleTime.jobDetail,
    gcTime: gcTime.jobs,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.hasActiveJobs) {
        return refetchInterval.activeJob
      }
      return false
    },
  })
}
