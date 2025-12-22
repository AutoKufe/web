/**
 * useJobsCache Hook
 *
 * Manages jobs cache with automatic incremental sync
 */

import { useState, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api/client'
import {
  type Job,
  loadJobsCache,
  saveJobsCache,
  applyJobsSyncChanges,
  clearJobsCache
} from '@/lib/cache/jobs-cache'

export function useJobsCache() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const fetchingRef = useRef(false)

  /**
   * Fetch and sync jobs
   */
  const syncJobs = useCallback(async (forceFullSync = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      console.log('⏭️ Jobs fetch already in progress, skipping...')
      return
    }

    fetchingRef.current = true

    try {
      const cached = loadJobsCache()

      // If cache exists and not forcing full sync
      if (cached && !forceFullSync) {
        console.log(`📦 Jobs cache loaded (${cached.jobs.length} jobs), syncing...`)

        // Show cached data immediately
        setJobs(cached.jobs)
        setTotalCount(cached.total_count)
        setLoading(false)

        // Extract prefixes with timestamps for incremental sync
        const cachedPrefixesWithTimestamps = cached.jobs.map(job => {
          const prefix = job.id.substring(0, 8)
          const timestamp = job.updated_at || job.created_at
          return `${prefix}:${timestamp}`
        })

        // Incremental sync in background
        try {
          const response = await apiClient.syncJobs(cachedPrefixesWithTimestamps)

          if (response && !response.error) {
            const data = response as any

            if (data.sync_mode === 'incremental_prefixes') {
              const changes = data.changes?.modified_or_added || []

              console.log(`📊 Jobs sync: ${changes.length} changes`)

              if (changes.length > 0) {
                // Apply changes
                const updatedJobs = applyJobsSyncChanges(cached.jobs, changes)

                // Save to cache
                saveJobsCache(updatedJobs, data.total_count)

                // Update state
                setJobs(updatedJobs)
                setTotalCount(data.total_count)

                console.log(`✅ Jobs cache updated: ${changes.length} changes applied`)
              } else {
                console.log(`✅ Jobs cache up to date`)
              }
            }
          }
        } catch (syncError) {
          console.error('Error syncing jobs:', syncError)
          // Keep showing cached data even if sync fails
        }
      } else {
        // No cache or force full sync - fetch all
        console.log(`🔄 Fetching all jobs (full sync)`)
        setLoading(true)

        const response = await apiClient.syncJobs()

        if (response && !response.error) {
          const data = response as any
          const allJobs = data.changes?.modified_or_added || []

          // Save to cache
          saveJobsCache(allJobs, data.total_count)

          // Update state
          setJobs(allJobs)
          setTotalCount(data.total_count)
          setLoading(false)

          console.log(`✅ Jobs cache initialized: ${allJobs.length} jobs`)
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setLoading(false)
    } finally {
      fetchingRef.current = false
    }
  }, [])

  /**
   * Clear cache and refetch
   */
  const refreshCache = useCallback(async () => {
    clearJobsCache()
    await syncJobs(true)
  }, [syncJobs])

  return {
    jobs,
    loading,
    totalCount,
    syncJobs,
    refreshCache
  }
}
