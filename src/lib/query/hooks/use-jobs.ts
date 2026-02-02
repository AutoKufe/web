'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { queryKeys } from '../keys'
import { staleTime, gcTime, refetchInterval, ACTIVE_JOB_STATUSES } from '../config'

/**
 * Job interface matching backend response
 */
export interface Job {
  id: string
  job_name: string
  status: string
  entity_id?: string
  entity_name?: string
  entity_nit?: string
  date_range?: {
    start_date: string
    end_date: string
  }
  document_filter?: string
  docs_processed?: number
  docs_total?: number
  docs_unique?: number
  created_at: string
  updated_at?: string
  completed_at?: string
  error_code?: string
  error_message?: string
  error_category?: string
  technical_review_status?: string
  progress_data?: {
    phase?: string
    message?: string
    percentage?: number
  }
  // Detail-only fields
  document_categories?: string | string[]
  consolidation_interval?: string
  processing_start_time?: string
  stage?: string
  progress_percentage?: number
}

/**
 * Minimal job for dashboard/recent lists
 */
export interface JobSummary {
  id: string
  job_name: string
  status: string
  entity_name?: string
  created_at: string
}

interface JobsListResponse {
  jobs: Array<{
    job_id?: string
    id?: string
    job_name: string
    status: string
    entity_id?: string
    entity_name?: string
    start_date?: string
    end_date?: string
    processed_documents?: number
    total_documents?: number
    created_at: string
    updated_at?: string
    completed_at?: string
    error_code?: string
  }>
  total_count: number
  per_page: number
}

interface JobDetailResponse {
  job_data: {
    job_id: string
    job_name: string
    status: string
    entity_id?: string
    entity_name?: string
    start_date?: string
    end_date?: string
    processed_documents?: number
    total_documents?: number
    unique_documents?: number
    created_at: string
    updated_at?: string
    completed_at?: string
    processing_start_time?: string
    error_code?: string
    error_message?: string
    error_category?: string
    document_categories?: string | string[]
    consolidation_interval?: string
    stage?: string
    progress_percentage?: number
    progress_data?: {
      phase?: string
      message?: string
      percentage?: number
    }
  }
}

interface JobsQueryResult {
  jobs: Job[]
  totalCount: number
  totalPages: number
  hasActiveJobs: boolean
}

/**
 * Transform raw job response to Job interface
 */
function mapJobResponse(job: JobsListResponse['jobs'][0]): Job {
  return {
    id: job.job_id || job.id || '',
    job_name: job.job_name,
    status: job.status,
    entity_id: job.entity_id,
    entity_name: job.entity_name,
    date_range:
      job.start_date && job.end_date
        ? { start_date: job.start_date, end_date: job.end_date }
        : undefined,
    docs_processed: job.processed_documents,
    docs_total: job.total_documents,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
    error_code: job.error_code,
  }
}

/**
 * Fetch paginated jobs list
 *
 * Use this for /trabajos page with full job data.
 */
export function useJobs(page = 1, pageSize = 10) {
  return useQuery<JobsQueryResult>({
    queryKey: queryKeys.jobs.list(page),
    queryFn: async () => {
      const response = await apiClient.listJobs(page, pageSize)

      if (response.error) {
        throw new Error(response.message || 'Error fetching jobs')
      }

      const data = response as unknown as JobsListResponse
      const jobs: Job[] = (data.jobs || []).map(mapJobResponse)

      const hasActiveJobs = jobs.some((job) => ACTIVE_JOB_STATUSES.includes(job.status))

      return {
        jobs,
        totalCount: data.total_count || 0,
        totalPages: Math.ceil((data.total_count || 0) / (data.per_page || pageSize)),
        hasActiveJobs,
      }
    },
    staleTime: staleTime.jobs,
    gcTime: gcTime.jobs,
  })
}

/**
 * Fetch jobs list with auto-polling when active jobs exist
 *
 * Use this for /trabajos page to keep status updated.
 */
export function useJobsWithPolling(page = 1, pageSize = 10) {
  return useQuery<JobsQueryResult>({
    queryKey: queryKeys.jobs.list(page),
    queryFn: async () => {
      const response = await apiClient.listJobs(page, pageSize)

      if (response.error) {
        throw new Error(response.message || 'Error fetching jobs')
      }

      const data = response as unknown as JobsListResponse
      const jobs: Job[] = (data.jobs || []).map(mapJobResponse)

      const hasActiveJobs = jobs.some((job) => ACTIVE_JOB_STATUSES.includes(job.status))

      return {
        jobs,
        totalCount: data.total_count || 0,
        totalPages: Math.ceil((data.total_count || 0) / (data.per_page || pageSize)),
        hasActiveJobs,
      }
    },
    staleTime: staleTime.jobs,
    gcTime: gcTime.jobs,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.hasActiveJobs) {
        return refetchInterval.jobsListWithActive
      }
      return false
    },
  })
}

/**
 * Get recent jobs for dashboard (minimal fields)
 *
 * Uses page 1 cache and transforms with select for efficiency.
 * If jobs are already cached, returns instantly.
 */
export function useRecentJobs(limit = 5) {
  return useQuery<JobsQueryResult, Error, { jobs: JobSummary[]; hasActiveJobs: boolean }>({
    queryKey: queryKeys.jobs.list(1),
    queryFn: async () => {
      const response = await apiClient.listJobs(1, limit)

      if (response.error) {
        throw new Error(response.message || 'Error fetching jobs')
      }

      const data = response as unknown as JobsListResponse
      const jobs: Job[] = (data.jobs || []).map(mapJobResponse)

      const hasActiveJobs = jobs.some((job) => ACTIVE_JOB_STATUSES.includes(job.status))

      return {
        jobs,
        totalCount: data.total_count || 0,
        totalPages: Math.ceil((data.total_count || 0) / limit),
        hasActiveJobs,
      }
    },
    staleTime: staleTime.jobs,
    gcTime: gcTime.jobs,
    select: (data) => ({
      jobs: data.jobs.slice(0, limit).map((job) => ({
        id: job.id,
        job_name: job.job_name,
        status: job.status,
        entity_name: job.entity_name,
        created_at: job.created_at,
      })),
      hasActiveJobs: data.hasActiveJobs,
    }),
  })
}

/**
 * Get a job from the list cache
 *
 * Useful for quick lookups without API calls.
 */
export function useJobFromList(jobId: string | null | undefined) {
  const queryClient = useQueryClient()

  if (!jobId) {
    return null
  }

  // Check page 1 cache (most common case)
  const page1Cache = queryClient.getQueryData<JobsQueryResult>(queryKeys.jobs.list(1))
  if (page1Cache) {
    const job = page1Cache.jobs.find((j) => j.id === jobId)
    if (job) return job
  }

  return null
}

/**
 * Fetch a single job by ID with auto-polling for active jobs
 *
 * Use this for /trabajos/[id] detail page.
 */
export function useJob(jobId: string | undefined) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId!),
    queryFn: async () => {
      // First, try to get basic data from list cache
      const listCache = queryClient.getQueryData<JobsQueryResult>(queryKeys.jobs.list(1))
      const cachedJob = listCache?.jobs.find((j) => j.id === jobId)

      // Always fetch fresh data for detail (has progress_data)
      const response = await apiClient.getJobStatus(jobId!)

      if (response.error) {
        throw new Error(response.message || 'Error fetching job')
      }

      const data = response as unknown as JobDetailResponse
      const jobData = data.job_data

      if (!jobData) {
        throw new Error('Job not found')
      }

      const job: Job = {
        id: jobData.job_id,
        job_name: jobData.job_name,
        status: jobData.status,
        entity_id: jobData.entity_id,
        entity_name: jobData.entity_name || cachedJob?.entity_name,
        date_range:
          jobData.start_date && jobData.end_date
            ? { start_date: jobData.start_date, end_date: jobData.end_date }
            : undefined,
        docs_processed: jobData.processed_documents,
        docs_total: jobData.total_documents,
        docs_unique: jobData.unique_documents,
        created_at: jobData.created_at,
        updated_at: jobData.updated_at,
        completed_at: jobData.completed_at,
        processing_start_time: jobData.processing_start_time,
        error_code: jobData.error_code,
        error_message: jobData.error_message,
        error_category: jobData.error_category,
        document_categories: jobData.document_categories,
        consolidation_interval: jobData.consolidation_interval,
        stage: jobData.stage,
        progress_percentage: jobData.progress_percentage,
        progress_data: jobData.progress_data,
      }

      return job
    },
    enabled: !!jobId,
    staleTime: staleTime.jobDetail,
    gcTime: gcTime.jobs,
    refetchInterval: (query) => {
      const job = query.state.data
      if (job && ACTIVE_JOB_STATUSES.includes(job.status)) {
        return refetchInterval.activeJob
      }
      return false
    },
  })
}

/**
 * Check cached raw Excel availability for dev jobs
 */
export function useCachedExcelCheck(
  entityId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.jobs.cachedExcel(entityId!, startDate!, endDate!),
    queryFn: async () => {
      const response = await apiClient.checkCachedRawExcel(entityId!, startDate!, endDate!)

      if (response.error) {
        return { available: false }
      }

      return response as { available: boolean; cached_at?: string }
    },
    enabled: enabled && !!entityId && !!startDate && !!endDate,
    staleTime: staleTime.jobs,
  })
}
