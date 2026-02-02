'use client'

/**
 * Skeleton for dashboard stats cards
 */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  )
}

/**
 * Skeleton for dashboard recent jobs list
 */
export function DashboardJobsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for dashboard recent entities grid
 */
export function DashboardEntitiesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted animate-pulse rounded" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 w-full max-w-[150px] bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Full dashboard skeleton combining all elements
 */
export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-9 w-32 bg-muted animate-pulse rounded" />
      </div>

      {/* Stats */}
      <DashboardStatsSkeleton />

      {/* Recent Jobs */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <DashboardJobsSkeleton />
      </div>

      {/* Recent Entities */}
      <div className="space-y-4">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <DashboardEntitiesSkeleton />
      </div>
    </div>
  )
}
