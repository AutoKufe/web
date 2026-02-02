/**
 * React Query Configuration
 *
 * Centralized stale time and cache configuration for different resources.
 */

// Time constants (in milliseconds)
const SECONDS = 1000
const MINUTES = 60 * SECONDS

/**
 * Stale time configuration per resource type
 *
 * Stale time = how long data is considered fresh before background refetch
 */
export const staleTime = {
  // Entities change infrequently (registration, updates)
  entities: 5 * MINUTES,

  // Jobs change frequently during processing
  jobs: 30 * SECONDS,
  jobDetail: 30 * SECONDS,

  // DIAN emails change when OAuth status updates
  dianEmails: 2 * MINUTES,

  // Usage updates after job completion
  usage: 1 * MINUTES,

  // Subscription rarely changes
  subscription: 10 * MINUTES,

  // Plans are static
  plans: 30 * MINUTES,

  // Entity-specific data
  tokenStatus: 1 * MINUTES,
  autoTokenStatus: 1 * MINUTES,
  jobCreationOptions: 1 * MINUTES,

  // Notifications
  notificationStatus: 5 * MINUTES,
}

/**
 * Garbage collection time configuration
 *
 * GC time = how long inactive data stays in cache before removal
 */
export const gcTime = {
  entities: 30 * MINUTES,
  jobs: 10 * MINUTES,
  dianEmails: 15 * MINUTES,
  usage: 5 * MINUTES,
  subscription: 30 * MINUTES,
  plans: 60 * MINUTES,
}

/**
 * Refetch intervals for active polling
 */
export const refetchInterval = {
  // Poll active jobs every 5 seconds
  activeJob: 5 * SECONDS,

  // Poll jobs list every 30 seconds when there are active jobs
  jobsListWithActive: 30 * SECONDS,
}

/**
 * Job statuses that indicate active processing
 */
export const ACTIVE_JOB_STATUSES = ['processing', 'pending', 'queued', 'waiting_token']
