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
  async listEntities(page = 1, pageSize = 10) {
    return this.request('GET', '/api/entities/', undefined, {
      page: page.toString(),
      page_size: pageSize.toString(),
    })
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

    return this.request('GET', '/api/entities/search', undefined, searchParams)
  }

  async registerEntity(dianToken: string) {
    return this.request('POST', '/api/entities/register', { dian_token: dianToken })
  }

  async getEntity(entityId: string) {
    return this.request('GET', `/api/entities/${entityId}`)
  }

  async getEntityTokenStatus(entityId: string) {
    return this.request('GET', `/api/entities/${entityId}/token-status`)
  }

  async getEntityAutoTokenStatus(entityId: string) {
    return this.request<{
      auto_token_available: boolean
      status: 'available' | 'not_configured' | 'token_not_received' | 'email_expired'
      dian_email_masked?: string
    }>('GET', `/api/entities/${entityId}/auto-token-status`)
  }

  async getEntityJobCreationOptions(entityId: string) {
    return this.request<{
      auto_management: {
        available: boolean
        status: string
        message: string
        dian_email_masked?: string
        should_be_default: boolean
      }
      saved_token: {
        available: boolean
        token_masked?: string
        should_be_default: boolean
      }
      manual_token: {
        available: boolean
        should_be_default: boolean
      }
      recommended_option: 'auto' | 'saved' | 'manual'
    }>('GET', `/api/entities/${entityId}/job-creation-options`)
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
    }>('GET', '/api/dian-emails/list')
  }

  async registerDianEmail(dianEmail: string) {
    return this.request('POST', '/api/dian-emails/register', { dian_email: dianEmail })
  }

  async getDianEmailDetails(dianEmailId: string) {
    return this.request('GET', `/api/dian-emails/${dianEmailId}/details`)
  }

  async deactivateDianEmail(dianEmailId: string) {
    return this.request('POST', `/api/dian-emails/${dianEmailId}/deactivate`)
  }

  async reactivateDianEmail(dianEmailId: string) {
    return this.request('POST', `/api/dian-emails/${dianEmailId}/reactivate`)
  }

  async regenerateOAuthUrl(dianEmailId: string) {
    return this.request('POST', `/api/dian-emails/${dianEmailId}/regenerate-oauth`)
  }

  // === JOBS ===
  async createJobWithToken(
    dianToken: string,
    jobData: {
      entity_id?: string
      job_name?: string
      date_range: { start_date: string; end_date: string }
      document_categories: string | string[]
      consolidation_interval: string | { value: number; unit: string } | null
    },
    confirmEntity = false,
    traceId?: string
  ) {
    const data: Record<string, unknown> = {
      dian_token: dianToken,
      job_data: jobData,
    }

    if (confirmEntity) {
      data.confirm_entity = true
    }

    if (traceId) {
      data.trace_id = traceId
    }

    return this.request('POST', '/api/jobs/create-with-token', data)
  }

  async listJobs(page = 1, pageSize = 10) {
    return this.request('GET', '/api/jobs/list', undefined, {
      page: page.toString(),
      page_size: pageSize.toString(),
    })
  }

  async getJobStatus(jobId: string) {
    return this.request('GET', `/api/jobs/${jobId}/status`)
  }

  async cancelJob(jobId: string) {
    return this.request('POST', `/api/jobs/${jobId}/cancel`)
  }

  async downloadExcel(jobId: string): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
    try {
      console.log('[apiClient.downloadExcel] jobId:', jobId)
      const headers: HeadersInit = {}

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`
      }

      const url = `${API_BASE}/api/storage/download-excel/${jobId}`
      console.log('[apiClient.downloadExcel] URL:', url)

      const response = await fetch(url, {
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
      console.log('[apiClient.downloadExcel] Content-Disposition:', contentDisposition)
      let filename = 'reporte.xlsx'

      if (contentDisposition) {
        // Parse filename from Content-Disposition header
        // Format: attachment; filename="name.xlsx"
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        console.log('[apiClient.downloadExcel] filenameMatch:', filenameMatch)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
          console.log('[apiClient.downloadExcel] Parsed filename:', filename)
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
}

export const apiClient = new ApiClient()
