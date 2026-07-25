"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "../keys";

interface CreateJobData {
  dianToken: string;
  jobData: {
    entity_id?: string;
    job_name?: string;
    date_range: { start_date: string; end_date: string };
    document_categories: string[];
    consolidation_interval: string | { value: number; unit: string } | null;
    is_dev_job?: boolean;
    job_type?: "formularios" | "detallado";
    listing_source?: "dian_scraping" | "user_uploaded_excel";
    download_mode?: "token_http" | "public_portal_captcha";
    listing_excel_file_id?: string;
  };
}

/**
 * Create a new job
 */
export class DuplicateJobError extends Error {
  existingJobId: string;
  existingStatus: string;
  constructor(message: string, existingJobId: string, existingStatus: string) {
    super(message);
    this.name = "DuplicateJobError";
    this.existingJobId = existingJobId;
    this.existingStatus = existingStatus;
  }
}

/**
 * Upload the DIAN listing Excel the user exported manually. Returns
 * file_id to use as jobData.listing_excel_file_id in useCreateJob.
 */
export class EntityNotDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityNotDetectedError";
  }
}

export function useUploadListingExcel() {
  return useMutation({
    mutationFn: async ({
      file,
      entityId,
    }: {
      file: File;
      entityId?: string;
    }) => {
      const response = await apiClient.uploadListingExcel(file, entityId);

      if (response.error) {
        if (response.error === "entity_not_detected") {
          throw new EntityNotDetectedError(
            response.message || "No se pudo detectar la entidad",
          );
        }
        throw new Error(response.message || "Error subiendo el Excel");
      }

      return response as {
        file_id: string;
        row_count: number;
        date_range: { start_date: string; end_date: string };
        entity: {
          id: string;
          display_name: string | null;
          identifier_suffix: string | null;
          type: string | null;
        };
        entity_auto_detected: boolean;
      };
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateJobData) => {
      const response = await apiClient.createJob(data.dianToken, data.jobData);

      if (response.error) {
        const detail = (response as Record<string, unknown>).detail as
          Record<string, unknown> | undefined;
        if (detail?.code === "duplicate_active_job") {
          throw new DuplicateJobError(
            response.message ||
              "Ya existe un trabajo activo con los mismos parámetros.",
            String(detail.existing_job_id || ""),
            String(detail.existing_status || ""),
          );
        }
        throw new Error(response.message || "Error creating job");
      }

      return response as {
        success: boolean;
        job_id: string;
        message: string;
      };
    },
    onSuccess: () => {
      // Invalidate jobs list to show new job
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      // Invalidate usage (docs may be consumed)
      queryClient.invalidateQueries({ queryKey: queryKeys.usage });
    },
  });
}

/**
 * Cancel a job
 */
export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.cancelJob(jobId);

      if (response.error) {
        throw new Error(response.message || "Error canceling job");
      }

      return response;
    },
    onSuccess: (_, jobId) => {
      // Invalidate specific job
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      // Invalidate jobs list
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/**
 * Mark a job as failed (staging only, dev role required)
 */
export function useMarkJobAsFailed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.markJobAsFailed(jobId);

      if (response.error) {
        throw new Error(response.message || "Error marking job as failed");
      }

      return response;
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/**
 * Create batch jobs for multiple entities
 */
export function useCreateBatchJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      entity_type_filter: "natural" | "juridica" | "all";
      start_date: string;
      end_date: string;
      document_categories: string[];
      consolidation_interval: string | { value: number; unit: string } | null;
    }) => {
      const response = await apiClient.createBatchJobs(params);

      if (response.error) {
        throw new Error(response.message || "Error creating batch jobs");
      }

      return response as {
        success: boolean;
        created_count: number;
        failed_count: number;
        batch_id: string;
        created_jobs: Array<{
          job_id: string;
          entity_id: string;
          entity_name: string;
          status: string;
        }>;
        failed_jobs: Array<{
          entity_id: string;
          entity_name: string;
          error: string;
        }>;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.usage });
    },
  });
}

/**
 * Provide a new token for a job in waiting_token status
 */
export function useProvideToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      tokenUrl,
    }: {
      jobId: string;
      tokenUrl: string;
    }) => {
      const response = await apiClient.provideToken(jobId, tokenUrl);

      if (response.error) {
        throw new Error(response.message || "Error providing token");
      }

      return response;
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}
