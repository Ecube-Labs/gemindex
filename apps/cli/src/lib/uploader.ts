import { newQueue } from '@henrygd/queue';
import type { ApiClient } from './api-client.js';
import type { SyncAction, UploadResult, DeleteResult } from '../types/index.js';

export type { UploadResult, DeleteResult };

export interface UploaderConfig {
  concurrency: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * Upload a single file with retry logic.
 */
async function uploadWithRetry(
  client: ApiClient,
  storeName: string,
  action: SyncAction,
  maxRetries: number,
  baseDelayMs: number,
  signal?: AbortSignal
): Promise<UploadResult> {
  if (!action.localFile) {
    return { action, success: false, error: 'No local file', retries: 0 };
  }

  // Check if already aborted
  if (signal?.aborted) {
    return { action, success: false, error: 'Cancelled', retries: 0, cancelled: true };
  }

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      return { action, success: false, error: 'Cancelled', retries: attempt, cancelled: true };
    }

    // Exponential backoff (skip on first attempt)
    if (attempt > 0) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const result = await client.uploadFile(
        storeName,
        action.localFile.absolutePath,
        action.localFile.relativePath,
        signal
      );

      if (result.success) {
        return { action, success: true, retries: attempt };
      }

      lastError = result.error;

      // Don't retry on client errors (4xx)
      if (result.error?.includes('400') || result.error?.includes('403')) {
        break;
      }
    } catch (error) {
      if (signal?.aborted) {
        return { action, success: false, error: 'Cancelled', retries: attempt, cancelled: true };
      }
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return {
    action,
    success: false,
    error: lastError,
    retries: maxRetries,
  };
}

/**
 * Execute uploads with concurrency control.
 */
export async function executeUploads(
  client: ApiClient,
  storeName: string,
  actions: SyncAction[],
  config: Partial<UploaderConfig>,
  signal?: AbortSignal,
  onProgress?: (result: UploadResult) => void
): Promise<UploadResult[]> {
  const concurrency = config.concurrency || 8;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  const results: UploadResult[] = [];
  const queue = newQueue(concurrency);

  for (const action of actions) {
    if (signal?.aborted) {
      // Mark remaining as cancelled
      results.push({
        action,
        success: false,
        error: 'Cancelled',
        retries: 0,
        cancelled: true,
      });
      continue;
    }

    queue.add(async () => {
      const result = await uploadWithRetry(
        client,
        storeName,
        action,
        maxRetries,
        baseDelayMs,
        signal
      );
      results.push(result);
      onProgress?.(result);
    });
  }

  await queue.done();
  return results;
}

/**
 * Execute deletes with concurrency control.
 */
export async function executeDeletes(
  client: ApiClient,
  storeName: string,
  actions: SyncAction[],
  concurrency: number = 8,
  signal?: AbortSignal
): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  const queue = newQueue(concurrency);

  for (const action of actions) {
    if (signal?.aborted) {
      break;
    }

    if (!action.remoteFile) {
      results.push({ action, success: false, error: 'No remote file' });
      continue;
    }

    queue.add(async () => {
      try {
        await client.deleteFile(storeName, action.remoteFile!.name, signal);
        results.push({ action, success: true });
      } catch (error) {
        results.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  await queue.done();
  return results;
}
