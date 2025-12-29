import FormData from 'form-data';
import fs from 'fs';
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
    const response = await fetch(
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

    const data = await response.json();

    // Handle empty or non-array responses
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return (data as ApiFileResponse[]).map((f) => ({
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
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);

    form.append('file', fileStream, {
      filename: displayName,
    });

    // FormData with node-fetch requires special handling
    const response = await fetch(
      `${this.baseUrl}/api/stores/${encodeURIComponent(storeName)}/files`,
      {
        method: 'POST',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: form as any,
        headers: {
          ...form.getHeaders(),
          ...(this.headers['Authorization']
            ? { Authorization: this.headers['Authorization'] }
            : {}),
        },
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
    const response = await fetch(
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
