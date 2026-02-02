'use client'

import { TableCell, TableRow } from '@/components/ui/table'

/**
 * Skeleton row for jobs table
 */
export function JobTableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="h-4 w-28 bg-muted animate-pulse rounded" />
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-36 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-12 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
      </TableCell>
    </TableRow>
  )
}

/**
 * Multiple skeleton rows for loading state
 */
export function JobTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <JobTableRowSkeleton key={i} />
      ))}
    </>
  )
}

/**
 * Skeleton for job detail page
 */
export function JobDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          <div className="h-9 w-32 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Progress card */}
      <div className="h-32 bg-muted animate-pulse rounded-lg" />

      {/* Details grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  )
}
