/**
 * Jobs Cache Utility
 *
 * Manages localStorage cache for jobs with incremental sync support.
 * Separate cache for better performance and instant loading.
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
  created_at: string
  updated_at?: string
  technical_review_status?: string
  reported_error_at?: string
  reviewed_at?: string
  resolved_at?: string
  reviewed_by?: string
  resolution_notes?: string
  error_category?: string
  completed_at?: string
}

export interface JobsCache {
  jobs: Job[]
  total_count: number
}

const CACHE_KEY = 'autokufe_jobs_cache'

/**
 * Load jobs from localStorage
 */
export function loadJobsCache(): JobsCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data: JobsCache = JSON.parse(cached)
    return data
  } catch (err) {
    console.error('Error loading jobs cache:', err)
    return null
  }
}

/**
 * Save jobs to localStorage
 */
export function saveJobsCache(jobs: Job[], total_count: number) {
  try {
    const cache: JobsCache = {
      jobs,
      total_count
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    console.log(`💾 Jobs cache saved: ${jobs.length} jobs`)
  } catch (err) {
    console.error('Error saving jobs cache:', err)
  }
}

/**
 * Clear jobs cache
 */
export function clearJobsCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
    console.log('🗑️ Jobs cache cleared')
  } catch (err) {
    console.error('Error clearing jobs cache:', err)
  }
}

/**
 * Get job by ID from cache
 */
export function getJobFromCache(job_id: string | null | undefined): Job | null {
  if (!job_id) return null

  const cache = loadJobsCache()
  if (!cache) return null

  return cache.jobs.find(job => job.id === job_id) || null
}

/**
 * Get job by prefix (8 chars) from cache
 */
export function getJobByPrefix(prefix: string): Job | null {
  const cache = loadJobsCache()
  if (!cache) return null

  return cache.jobs.find(job => job.id.startsWith(prefix)) || null
}

/**
 * Apply incremental sync changes to cached jobs
 */
export function applyJobsSyncChanges(
  cachedJobs: Job[],
  changes: Job[]
): Job[] {
  const jobMap: Record<string, Job> = {}

  // Add cached jobs
  cachedJobs.forEach(job => {
    jobMap[job.id] = job
  })

  // Apply changes (modifications and additions)
  changes.forEach(job => {
    jobMap[job.id] = job
  })

  return Object.values(jobMap)
}
