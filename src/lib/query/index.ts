/**
 * React Query exports
 *
 * Re-exports all hooks and utilities for convenient imports.
 */

// Provider
export { QueryProvider } from './provider'

// Keys
export { queryKeys } from './keys'

// Config
export { staleTime, gcTime, refetchInterval, ACTIVE_JOB_STATUSES } from './config'

// Entity hooks
export {
  useEntities,
  useEntitiesSelector,
  useEntityFromList,
  useEntity,
  useSearchEntities,
  useEntityTokenStatus,
  useEntityAutoTokenStatus,
  useEntityJobCreationOptions,
  useUpdateEntityTaxConfig,
  type Entity,
  type EntitySelectorItem,
  type EntityTaxConfig,
} from './hooks/use-entities'

// Job hooks
export {
  useJobs,
  useJobsWithPolling,
  useRecentJobs,
  useJobFromList,
  useJob,
  useCachedExcelCheck,
  type Job,
  type JobSummary,
} from './hooks/use-jobs'

// DIAN Email hooks
export {
  useDianEmails,
  useDianEmailFromList,
  useDianEmailLookup,
  useDianEmail,
  type DianEmail,
} from './hooks/use-dian-emails'

// Usage hooks
export {
  useUsage,
  useSubscription,
  usePlans,
  useCanDownload,
  type UsageData,
  type SubscriptionData,
} from './hooks/use-usage'

// Entity mutations
export {
  useRegisterEntity,
  useRegisterEntityManual,
  useDeleteEntity,
  useCleanupEntityStorage,
  type ManualEntityData,
} from './mutations/entity-mutations'

// Job mutations
export {
  useCreateJob,
  useCreateBatchJobs,
  useCancelJob,
  useMarkJobAsFailed,
  useProvideToken,
} from './mutations/job-mutations'

// DIAN Email mutations
export {
  useRegisterDianEmail,
  useDeactivateDianEmail,
  useReactivateDianEmail,
  useRegenerateOAuthUrl,
} from './mutations/dian-email-mutations'
