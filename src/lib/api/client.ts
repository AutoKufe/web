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

  async registerEntity(dianToken: string) {
    return this.request('POST', '/entities/register', { dian_token: dianToken })
  }

  async getEntity(entityId: string) {
    return this.request('GET', `/entities/${entityId}`)
  }

  async deleteEntity(entityId: string) {
    return this.request('DELETE', `/entities/${entityId}`)
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

  // === JOBS ===
  async createJob(
    dianToken: string,
    jobData: {
      entity_id?: string
      job_name?: string
      date_range: { start_date: string; end_date: string }
      document_categories: string[]
      consolidation_interval: string | { value: number; unit: string } | null
    }
  ) {
    return this.request('POST', '/jobs/create-job', {
      dian_token: dianToken,
      job_data: jobData,
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
}

export const apiClient = new ApiClient()
