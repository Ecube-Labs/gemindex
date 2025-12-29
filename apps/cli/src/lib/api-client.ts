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

    const response = await fetch(
      `${this.baseUrl}/api/stores/${encodeURIComponent(storeName)}/files`,
      {
        method: 'POST',
        body: form,
        headers: {
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
