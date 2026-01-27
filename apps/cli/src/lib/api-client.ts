import fs from 'fs/promises';
import path from 'path';
import type { RemoteFile } from '../types/index.js';

export interface ApiClientConfig {
  endpoint: string;
  token?: string;
}

interface ApiFileResponse {
  name: string;
  displayName: string;
  originalDisplayName?: string;
  sha256?: string;
  state: string;
}

/**
 * Custom error class for API connection failures.
 */
export class ApiConnectionError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

/**
 * Wrap fetch to provide helpful error messages for connection failures.
 */
async function fetchWithConnectionCheck(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    const endpoint = new URL(url).origin;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common connection error patterns
    if (
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network')
    ) {
      throw new ApiConnectionError(
        `Cannot connect to API server at ${endpoint}\n\n` +
          `Possible solutions:\n` +
          `  1. Check if the API server is running\n` +
          `  2. Verify the endpoint URL in your config file\n` +
          `  3. Check your network connection\n` +
          `  4. If using a custom endpoint, ensure it's accessible\n\n` +
          `Original error: ${errorMessage}`,
        endpoint,
        error instanceof Error ? error : undefined
      );
    }

    throw error;
  }
}

export class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.endpoint.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };
    if (config.token) {
      this.headers['Authorization'] = `Bearer ${config.token}`;
    }
  }

  /**
   * List files in a store.
   */
  async listFiles(storeName: string, signal?: AbortSignal): Promise<RemoteFile[]> {
    const response = await fetchWithConnectionCheck(
      `${this.baseUrl}/api/stores/${encodeURIComponent(storeName)}/files`,
      {
        headers: this.headers,
        signal,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to list files: ${(error as { message: string }).message}`);
    }

    const data = (await response.json()) as { files?: ApiFileResponse[] } | ApiFileResponse[];

    // Handle both { files: [...] } and direct array responses
    const files = Array.isArray(data) ? data : (data.files ?? []);

    return files.map((f) => ({
      name: f.name,
      displayName: f.displayName,
      originalFileName: f.originalDisplayName || f.displayName,
      sha256: f.sha256,
      state: f.state,
    }));
  }

  /**
   * Upload a file to a store.
   */
  async uploadFile(
    storeName: string,
    filePath: string,
    displayName: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; error?: string }> {
    // Read file as buffer and create Blob
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(displayName);

    // Use native FormData (available in Node.js 18+)
    const form = new FormData();
    const blob = new Blob([fileBuffer]);
    form.append('file', blob, fileName);

    const headers: Record<string, string> = {};
    if (this.headers['Authorization']) {
      headers['Authorization'] = this.headers['Authorization'];
    }

    const response = await fetchWithConnectionCheck(
      `${this.baseUrl}/api/stores/${encodeURIComponent(storeName)}/files`,
      {
        method: 'POST',
        body: form,
        headers,
        signal,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      return { success: false, error: (error as { message: string }).message };
    }

    return { success: true };
  }

  /**
   * Delete a file from a store.
   */
  async deleteFile(storeName: string, documentName: string, signal?: AbortSignal): Promise<void> {
    const response = await fetchWithConnectionCheck(
      `${this.baseUrl}/api/stores/${encodeURIComponent(storeName)}/files/${encodeURIComponent(documentName)}`,
      {
        method: 'DELETE',
        headers: this.headers,
        signal,
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to delete file: ${(error as { message: string }).message}`);
    }
  }
}
