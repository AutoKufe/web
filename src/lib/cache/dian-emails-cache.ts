/**
 * DIAN Emails Cache Utility
 *
 * Manages localStorage cache for DIAN emails with incremental sync support.
 * Separate from entities cache for better granularity and performance.
 */

export interface DianEmail {
  id: string
  email_masked: string
  auth_status: 'active' | 'pending' | 'expired' | 'revoked' | 'inactive' | 'failed'
  authorized_at?: string | null
  deactivated_at?: string | null
  failed_at?: string | null
  expired_at?: string | null
  updated_at?: string
  created_at: string
  associated_entities_count: number
}

export interface DianEmailsCache {
  emails: DianEmail[]
  total_count: number
}

const CACHE_KEY = 'autokufe_dian_emails_cache'

/**
 * Load dian_emails from localStorage
 */
export function loadDianEmailsCache(): DianEmailsCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data: DianEmailsCache = JSON.parse(cached)
    return data
  } catch (err) {
    console.error('Error loading dian_emails cache:', err)
    return null
  }
}

/**
 * Save dian_emails to localStorage
 */
export function saveDianEmailsCache(emails: DianEmail[], total_count: number) {
  try {
    const cache: DianEmailsCache = {
      emails,
      total_count
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    console.log(`💾 DIAN emails cache saved: ${emails.length} emails`)
  } catch (err) {
    console.error('Error saving dian_emails cache:', err)
  }
}

/**
 * Clear dian_emails cache
 */
export function clearDianEmailsCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
    console.log('🗑️ DIAN emails cache cleared')
  } catch (err) {
    console.error('Error clearing dian_emails cache:', err)
  }
}

/**
 * Get dian_email by ID from cache
 */
export function getDianEmailFromCache(dian_email_id: string | null | undefined): DianEmail | null {
  if (!dian_email_id) return null

  const cache = loadDianEmailsCache()
  if (!cache) return null

  return cache.emails.find(email => email.id === dian_email_id) || null
}

/**
 * Get dian_email by prefix (8 chars) from cache
 */
export function getDianEmailByPrefix(prefix: string): DianEmail | null {
  const cache = loadDianEmailsCache()
  if (!cache) return null

  return cache.emails.find(email => email.id.startsWith(prefix)) || null
}

/**
 * Apply incremental sync changes to cached dian_emails
 */
export function applyDianEmailsSyncChanges(
  cachedEmails: DianEmail[],
  changes: DianEmail[]
): DianEmail[] {
  const emailMap: Record<string, DianEmail> = {}

  // Add cached emails
  cachedEmails.forEach(email => {
    emailMap[email.id] = email
  })

  // Apply changes (modifications and additions)
  changes.forEach(email => {
    emailMap[email.id] = email
  })

  return Object.values(emailMap)
}
