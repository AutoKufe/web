'use client'

import { TableCell, TableRow } from '@/components/ui/table'

/**
 * Skeleton row for entity table
 */
export function EntityTableRowSkeleton() {
  return (
    <TableRow className="border-b">
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-16 bg-muted animate-pulse rounded font-mono" />
      </TableCell>
      <TableCell>
        <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
      </TableCell>
      <TableCell>
        <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
      </TableCell>
      <TableCell className="pr-6">
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
      </TableCell>
    </TableRow>
  )
}

/**
 * Multiple skeleton rows for loading state
 */
export function EntityTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <EntityTableRowSkeleton key={i} />
      ))}
    </>
  )
}

/**
 * Skeleton card for entity detail page
 */
export function EntityDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  )
}
