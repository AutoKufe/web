/**
 * API Client for AutoKufe Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.autokufe.com'

interface ApiResponse<T = unknown> {
  success?: boolean
  status?: string
  error?: string
  message?: string
  data?: T
  [key: string]: unknown
}

export class ApiClient {
  private accessToken: string | null = null

  setAccessToken(token: string | null) {
    this.accessToken = token
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: Record<string, unknown>,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${API_BASE}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      })

      const json = await response.json()

      if (!response.ok) {
        return {
          error: json.detail?.error || json.error || 'Unknown error',
          message: json.detail?.message || json.message || 'Request failed',
          ...json,
        }
      }

      return json
    } catch (error) {
      return {
        error: 'network_error',
        message: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  // Health check
  async health() {
    return this.request('GET', '/health')
  }

  // Auth check
  async authCheck() {
    return this.request('GET', '/auth-check')
  }

  // === ENTITIES ===
  async listEntities(page = 1, pageSize = 10, since?: string, cachedPrefixes?: string[], verifyIds?: string[]) {
    const params: Record<string, string> = {
      page: page.toString(),
      page_size: pageSize.toString(),
    }

    if (since) {
      params.since = since
    }

    if (cachedPrefixes && cachedPrefixes.length > 0) {
      params.cached_prefixes = cachedPrefixes.join(',')
    }

    if (verifyIds && verifyIds.length > 0) {
      params.verify_ids = verifyIds.join(',')
    }

    return this.request('GET', '/entities/', undefined, params)
  }

  async searchEntities(params: {
    name?: string
    last_digits?: string
    entity_type?: string
    page_size?: number
  }) {
    const searchParams: Record<string, string> = {}
    if (params.name) searchParams.name = params.name
    if (params.last_digits) searchParams.last_digits = params.last_digits
    if (params.entity_type) searchParams.entity_type = params.entity_type
    if (params.page_size) searchParams.page_size = params.page_size.toString()

    return this.request('GET', '/entities/search', undefined, searchParams)
  }

  /**
   * Get entities for selector (minimal fields: id, display_name, identifier_suffix)
   * Uses selector_updated_at for granular cache invalidation
   */
  async listEntitiesSelector(since?: string, cachedPrefixes?: string[]) {
    const params: Record<string, string> = {}

    if (since) {
      params.since = since
    }

    if (cachedPrefixes && cachedPrefixes.length > 0) {
      params.cached_prefixes = cachedPrefixes.join(',')
    }

    return this.request('GET', '/entities/selector', undefined, params)
  }

  async registerEntity(dianToken: string) {
    return this.request('POST', '/entities/register', { dian_token: dianToken })
  }

  async getEntity(entityId: string) {
    return this.request('GET', `/entities/${entityId}`)
  }

  async deleteEntity(entityId: string) {
    return this.request('DELETE', `/entities/${entityId}`)
  }

  async updateEntityTaxConfig(
    entityId: string,
    config: {
      ciiu?: string | null
      contributor_type?: 'ordinario' | 'gran_contribuyente' | 'regimen_simple'
      is_iva_responsible?: boolean
      is_withholding_agent?: boolean
      is_self_withholder?: boolean
    }
  ) {
    return this.request<{
      status: string
      entity: {
        id: string
        ciiu: string | null
        contributor_type: string | null
        is_iva_responsible: boolean
        is_withholding_agent: boolean
        is_self_withholder: boolean
        updated_at: string
      }
    }>('PATCH', `/entities/${entityId}/tax-config`, config as Record<string, unknown>)
  }

  async getEntityTokenStatus(entityId: string) {
    return this.request('GET', `/entities/${entityId}/token-status`)
  }

  async getEntityAutoTokenStatus(entityId: string) {
    return this.request<{
      auto_token_available: boolean
      status: 'available' | 'not_configured' | 'token_not_received' | 'email_expired'
      dian_email_masked?: string
    }>('GET', `/entities/${entityId}/auto-token-status`)
  }

  async getEntityJobCreationOptions(entityId: string) {
    return this.request<{
      auto_management: {
        available: boolean
        status: string
        message: string
        dian_email_masked?: string
      }
      saved_token: {
        available: boolean
        token_masked?: string
      }
      recommended_option: 'auto' | 'saved' | 'manual'
    }>('GET', `/entities/${entityId}/job-creation-options`)
  }

  /**
   * Cleanup all storage files for an entity (staging only, dev role required)
   * Deletes files from B2 and DB records
   */
  async cleanupEntityStorage(entityId: string) {
    return this.request<{
      success: boolean
      files_deleted: number
      files_failed?: number
      space_freed_mb: number
      entity_name?: string
    }>('POST', `/entities/${entityId}/cleanup-storage`)
  }

  // === DIAN EMAILS ===
  async listDianEmails() {
    return this.request<{
      success: boolean
      dian_emails: Array<{
        dian_email_id: string
        email: string
        status: string
        requested_at: string
        authorized_at?: string
        deactivated_at?: string
        has_filter: boolean
      }>
      total: number
    }>('GET', '/dian-emails/list')
  }

  async registerDianEmail(dianEmail: string) {
    return this.request('POST', '/dian-emails/register', { dian_email: dianEmail })
  }

  async getDianEmailDetails(dianEmailId: string) {
    return this.request('GET', `/dian-emails/${dianEmailId}/details`)
  }

  async deactivateDianEmail(dianEmailId: string) {
    return this.request('POST', `/dian-emails/${dianEmailId}/deactivate`)
  }

  async reactivateDianEmail(dianEmailId: string) {
    return this.request('POST', `/dian-emails/${dianEmailId}/reactivate`)
  }

  async regenerateOAuthUrl(dianEmailId: string) {
    return this.request('POST', `/dian-emails/${dianEmailId}/regenerate-oauth`)
  }

  // === DIAN TOKEN VALIDATION ===

  /**
   * Quick validate a DIAN token URL and optionally save to entity
   *
   * If entityId is provided:
   * - Validates token matches entity (by NIT/document)
   * - Saves token to entity if valid
   * - Detects representative change (juridica) and updates if needed
   *
   * Returns representative_updated if rep legal changed (juridica only)
   */
  async quickValidateDianToken(tokenUrl: string, entityId?: string) {
    return this.request<{
      valid: boolean
      status: 'valid' | 'expired' | 'invalid' | 'error'
      error_code?: string
      token_saved?: boolean
      representative_updated?: boolean
      new_representative_name?: string
    }>('POST', '/dian/quick-validate', {
      token_url: tokenUrl,
      entity_id: entityId
    })
  }

  /**
   * Request automatic DIAN token for an entity
   * Validates rate limits and cooldowns before creating the request
   */
  async requestAutoToken(entityId: string) {
    return this.request<{
      success: boolean
      request_id?: string
      error_code?: string
      retry_after_seconds?: number
    }>('POST', '/dian/auto-token/request', {
      entity_id: entityId
    })
  }

  /**
   * Poll auto-token request status
   * Frontend should poll every 3-5 seconds
   */
  async getAutoTokenStatus(requestId: string) {
    return this.request<{
      success: boolean
      request_id?: string
      status?: 'pending' | 'polling' | 'received' | 'failed' | 'timeout'
      requested_at?: string
      polling_started_at?: string
      received_at?: string
      error_code?: string
    }>('GET', `/dian/auto-token/status/${requestId}`)
  }

  /**
   * Check if there's an active auto-token request for an entity
   * Used to restore UI state when user returns to page
   */
  async getActiveAutoTokenRequest(entityId: string) {
    return this.request<{
      has_active_request: boolean
      request_id?: string
      status?: 'pending' | 'polling'
      requested_at?: string
    }>('GET', `/dian/auto-token/active/${entityId}`)
  }

  // === JOBS ===
  async createJob(
    dianToken: string,
    jobData: {
      entity_id?: string
      job_name?: string
      date_range: { start_date: string; end_date: string }
      document_categories: string[]
      consolidation_interval: string | { value: number; unit: string } | null
      is_dev_job?: boolean  // Dev jobs use cached raw Excel (staging only)
    },
  ) {
    return this.request('POST', '/jobs/create-job', {
      dian_token: dianToken,
      job_data: jobData,
      is_dev_job: jobData.is_dev_job,  // Pass at top level for Backend
    })
  }

  /**
   * Check if cached raw Excel is available for dev jobs (staging only)
   */
  async checkCachedRawExcel(entityId: string, startDate: string, endDate: string) {
    return this.request('GET', `/jobs/check-cached-excel/${entityId}`, undefined, {
      start_date: startDate,
      end_date: endDate,
    })
  }

  async listJobs(page = 1, pageSize = 10) {
    return this.request('GET', '/jobs/list', undefined, {
      page: page.toString(),
      page_size: pageSize.toString(),
    })
  }

  async getJobStatus(jobId: string) {
    return this.request('GET', `/jobs/${jobId}/status`)
  }

  async cancelJob(jobId: string) {
    return this.request('POST', `/jobs/${jobId}/cancel`)
  }

  /**
   * Mark a job as failed (STAGING ONLY - requires dev role)
   * Used for testing error flows in development
   */
  async markJobAsFailed(jobId: string) {
    return this.request('POST', `/jobs/${jobId}/mark-failed`)
  }

  /**
   * Provide a new DIAN token for a job in waiting_token status
   * Validates the token, updates entity, and relaunches Core processing
   */
  async provideToken(jobId: string, tokenUrl: string) {
    return this.request<{
      success: boolean
      message: string
      job_id: string
      new_status: string
    }>('POST', `/jobs/${jobId}/provide-token`, { token_url: tokenUrl })
  }

  async downloadExcel(jobId: string): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
    try {
      const headers: HeadersInit = {}

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${API_BASE}/storage/download-excel/${jobId}`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.detail?.message || errorData.message || 'Error descargando Excel'
        }
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'reporte.xlsx'

      if (contentDisposition) {
        // Parse filename from Content-Disposition header
        // Format: attachment; filename="name.xlsx"
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      return {
        success: true,
        blob,
        filename
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red'
      }
    }
  }

  // === SUBSCRIPTIONS ===
  async getSubscription() {
    return this.request('GET', '/subscriptions/me')
  }

  async getUsage() {
    return this.request('GET', '/subscriptions/usage')
  }

  async canDownload(docCount = 1) {
    return this.request('GET', '/subscriptions/can-download', undefined, {
      doc_count: docCount.toString(),
    })
  }

  async getPlans() {
    return this.request('GET', '/subscriptions/plans')
  }
  async syncDianEmails(cachedPrefixesWithTimestamps?: string[]) {
    const params = new URLSearchParams()
    if (cachedPrefixesWithTimestamps && cachedPrefixesWithTimestamps.length > 0) {
      params.append('cached_prefixes', cachedPrefixesWithTimestamps.join(','))
    }

    const url = `/dian-emails/sync${params.toString() ? `?${params.toString()}` : ''}`

    return this.request<{
      status: string
      sync_mode: string
      collision_detected: boolean
      changes: {
        modified_or_added: Array<{
          id: string
          email_masked: string
          auth_status: string
          authorized_at?: string | null
          deactivated_at?: string | null
          failed_at?: string | null
          expired_at?: string | null
          updated_at?: string
          created_at: string
          associated_entities_count: number
        }>
        all_valid_prefixes: string[]
        colliding_prefixes: string[]
        count: number
      }
      needs_full_ids_for_prefixes: string[]
      total_count: number
    }>('GET', url)
  }


  async syncJobs(cachedPrefixesWithTimestamps?: string[]) {
    const params = new URLSearchParams()
    if (cachedPrefixesWithTimestamps && cachedPrefixesWithTimestamps.length > 0) {
      params.append('cached_prefixes', cachedPrefixesWithTimestamps.join(','))
    }

    const url = `/jobs/sync${params.toString() ? `?${params.toString()}` : ''}`

    return this.request<{
      status: string
      sync_mode: string
      collision_detected: boolean
      changes: {
        modified_or_added: Array<{
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
          completed_at?: string
        }>
        all_valid_prefixes: string[]
        colliding_prefixes: string[]
        count: number
      }
      needs_full_ids_for_prefixes: string[]
      total_count: number
    }>('GET', url)
  }

  // === LOGS (Admin Only) ===
  async downloadJobLogs(jobId: string): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
    try {
      const headers: HeadersInit = {}

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${API_BASE}/logs/jobs/${jobId}`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 403) {
          return {
            success: false,
            error: 'No tienes permisos para descargar logs. Requiere rol: super_admin o technical_support'
          }
        }

        if (response.status === 404) {
          return {
            success: false,
            error: errorData.detail || 'Logs no encontrados (pueden haber expirado o el job no completó)'
          }
        }

        return {
          success: false,
          error: errorData.detail || errorData.message || 'Error descargando logs'
        }
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'job.log'

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      return {
        success: true,
        blob,
        filename
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de red'
      }
    }
  }

  // === PUSH NOTIFICATIONS ===

  /**
   * Get VAPID public key for push subscription
   */
  async getVapidPublicKey() {
    return this.request<{ vapid_public_key: string }>('GET', '/notifications/vapid-public-key')
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToNotifications(subscription: {
    endpoint: string
    p256dh_key: string
    auth_key: string
    device_name?: string
  }) {
    return this.request('POST', '/notifications/subscribe', subscription)
  }

  /**
   * Unsubscribe from push notifications (soft-disable)
   */
  async unsubscribeFromNotifications(data: { endpoint: string }) {
    return this.request('POST', '/notifications/unsubscribe', data)
  }

  /**
   * Get push notification status for current user
   */
  async getNotificationStatus() {
    return this.request<{
      enabled: boolean
      devices: Array<{
        id: string
        device_name: string | null
        created_at: string
        endpoint_preview: string
      }>
      total_devices: number
    }>('GET', '/notifications/status')
  }
}

export const apiClient = new ApiClient()
