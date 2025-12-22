/**
 * useDianEmailsCache Hook
 *
 * Manages DIAN emails cache with automatic incremental sync
 */

import { useState, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api/client'
import {
  type DianEmail,
  loadDianEmailsCache,
  saveDianEmailsCache,
  applyDianEmailsSyncChanges,
  clearDianEmailsCache
} from '@/lib/cache/dian-emails-cache'

export function useDianEmailsCache() {
  const [emails, setEmails] = useState<DianEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const fetchingRef = useRef(false)

  /**
   * Fetch and sync DIAN emails
   */
  const syncDianEmails = useCallback(async (forceFullSync = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      console.log('⏭️ DIAN emails fetch already in progress, skipping...')
      return
    }

    fetchingRef.current = true

    try {
      const cached = loadDianEmailsCache()

      // If cache exists and not forcing full sync
      if (cached && !forceFullSync) {
        console.log(`📦 DIAN emails cache loaded (${cached.emails.length} emails), syncing...`)

        // Show cached data immediately
        setEmails(cached.emails)
        setTotalCount(cached.total_count)
        setLoading(false)

        // Extract prefixes with timestamps for incremental sync
        const cachedPrefixesWithTimestamps = cached.emails.map(email => {
          const prefix = email.id.substring(0, 8)
          const timestamp = email.updated_at || email.created_at
          return `${prefix}:${timestamp}`
        })

        // Incremental sync in background
        try {
          const response = await apiClient.syncDianEmails(cachedPrefixesWithTimestamps)

          if (response && !response.error) {
            const data = response as any

            if (data.sync_mode === 'incremental_prefixes') {
              const changes = data.changes?.modified_or_added || []

              console.log(`📊 DIAN emails sync: ${changes.length} changes`)

              if (changes.length > 0) {
                // Apply changes
                const updatedEmails = applyDianEmailsSyncChanges(cached.emails, changes)

                // Save to cache
                saveDianEmailsCache(updatedEmails, data.total_count)

                // Update state
                setEmails(updatedEmails)
                setTotalCount(data.total_count)

                console.log(`✅ DIAN emails cache updated: ${changes.length} changes applied`)
              } else {
                console.log(`✅ DIAN emails cache up to date`)
              }
            }
          }
        } catch (syncError) {
          console.error('Error syncing DIAN emails:', syncError)
          // Keep showing cached data even if sync fails
        }
      } else {
        // No cache or force full sync - fetch all
        console.log(`🔄 Fetching all DIAN emails (full sync)`)
        setLoading(true)

        const response = await apiClient.syncDianEmails()

        if (response && !response.error) {
          const data = response as any
          const allEmails = data.changes?.modified_or_added || []

          // Save to cache
          saveDianEmailsCache(allEmails, data.total_count)

          // Update state
          setEmails(allEmails)
          setTotalCount(data.total_count)
          setLoading(false)

          console.log(`✅ DIAN emails cache initialized: ${allEmails.length} emails`)
        }
      }
    } catch (error) {
      console.error('Error fetching DIAN emails:', error)
      setLoading(false)
    } finally {
      fetchingRef.current = false
    }
  }, [])

  /**
   * Clear cache and refetch
   */
  const refreshCache = useCallback(async () => {
    clearDianEmailsCache()
    await syncDianEmails(true)
  }, [syncDianEmails])

  return {
    emails,
    loading,
    totalCount,
    syncDianEmails,
    refreshCache
  }
}
