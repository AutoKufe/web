'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'

interface CreateJobData {
  dianToken: string
  jobData: {
    entity_id?: string
    job_name?: string
    date_range: { start_date: string; end_date: string }
    document_categories: string[]
    consolidation_interval: string | { value: number; unit: string } | null
    is_dev_job?: boolean
  }
}

/**
 * Create a new job
 */
export function useCreateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateJobData) => {
      const response = await apiClient.createJob(data.dianToken, data.jobData)

      if (response.error) {
        throw new Error(response.message || 'Error creating job')
      }

      return response as {
        success: boolean
        job_id: string
        message: string
      }
    },
    onSuccess: () => {
      // Invalidate jobs list to show new job
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
      // Invalidate usage (docs may be consumed)
      queryClient.invalidateQueries({ queryKey: queryKeys.usage })
    },
  })
}

/**
 * Cancel a job
 */
export function useCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.cancelJob(jobId)

      if (response.error) {
        throw new Error(response.message || 'Error canceling job')
      }

      return response
    },
    onSuccess: (_, jobId) => {
      // Invalidate specific job
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) })
      // Invalidate jobs list
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
    },
  })
}

/**
 * Mark a job as failed (staging only, dev role required)
 */
export function useMarkJobAsFailed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.markJobAsFailed(jobId)

      if (response.error) {
        throw new Error(response.message || 'Error marking job as failed')
      }

      return response
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
    },
  })
}

/**
 * Provide a new token for a job in waiting_token status
 */
export function useProvideToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ jobId, tokenUrl }: { jobId: string; tokenUrl: string }) => {
      const response = await apiClient.provideToken(jobId, tokenUrl)

      if (response.error) {
        throw new Error(response.message || 'Error providing token')
      }

      return response
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
    },
  })
}
