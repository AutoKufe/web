/**
 * React Query Key Factory
 *
 * Centralized query key management for consistent cache invalidation.
 * Keys are structured hierarchically for granular invalidation.
 */

export const queryKeys = {
  // Entities
  entities: {
    all: ['entities'] as const,
    list: (filters?: { search?: string }) =>
      [...queryKeys.entities.all, 'list', filters] as const,
    // Selector has its own key - NOT under 'all' to prevent invalidation when list changes
    // Uses selector_updated_at in DB, only invalidated when display_name/identifier_suffix change
    selector: () => ['entities-selector'] as const,
    detail: (id: string) =>
      [...queryKeys.entities.all, 'detail', id] as const,
    tokenStatus: (id: string) =>
      [...queryKeys.entities.detail(id), 'token-status'] as const,
    autoTokenStatus: (id: string) =>
      [...queryKeys.entities.detail(id), 'auto-token-status'] as const,
    jobCreationOptions: (id: string) =>
      [...queryKeys.entities.detail(id), 'job-creation-options'] as const,
  },

  // Pseudo bundles (per-entity, separate from entities cache)
  pseudoBundles: {
    all: ['pseudo-bundles'] as const,
    list: (entityId: string) =>
      [...queryKeys.pseudoBundles.all, 'list', entityId] as const,
  },

  // Jobs
  jobs: {
    all: ['jobs'] as const,
    list: (page?: number) =>
      [...queryKeys.jobs.all, 'list', { page }] as const,
    detail: (id: string) =>
      [...queryKeys.jobs.all, 'detail', id] as const,
    cachedExcel: (entityId: string, startDate: string, endDate: string) =>
      [...queryKeys.jobs.all, 'cached-excel', { entityId, startDate, endDate }] as const,
  },

  // DIAN Emails
  dianEmails: {
    all: ['dian-emails'] as const,
    list: () => [...queryKeys.dianEmails.all, 'list'] as const,
    detail: (id: string) =>
      [...queryKeys.dianEmails.all, 'detail', id] as const,
  },

  // Usage & Subscriptions
  usage: ['usage'] as const,
  subscription: ['subscription'] as const,
  plans: ['plans'] as const,

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    status: () => [...queryKeys.notifications.all, 'status'] as const,
    vapidKey: () => [...queryKeys.notifications.all, 'vapid-key'] as const,
  },
}
