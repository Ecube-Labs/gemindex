import type {
  FileSearchStore,
  FileSearchStoreFile,
  CreateStoreRequest,
  ListStoresResponse,
  ListFilesResponse,
  UploadFileRequest,
  SearchRequest,
  SearchResponse,
  Operation,
} from '@/types/api';

const API_BASE = '/api';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Stores API
export async function listStores(): Promise<FileSearchStore[]> {
  const data = await fetchApi<ListStoresResponse>('/stores');
  return data.stores;
}

export async function createStore(request: CreateStoreRequest): Promise<FileSearchStore> {
  return fetchApi<FileSearchStore>('/stores', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getStore(storeName: string): Promise<FileSearchStore> {
  return fetchApi<FileSearchStore>(`/stores/${encodeURIComponent(storeName)}`);
}

export async function deleteStore(storeName: string, force = false): Promise<void> {
  const response = await fetch(
    `${API_BASE}/stores/${encodeURIComponent(storeName)}?force=${force}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
}

// Files API
export async function listFiles(storeName: string): Promise<FileSearchStoreFile[]> {
  const data = await fetchApi<ListFilesResponse>(`/stores/${encodeURIComponent(storeName)}/files`);
  return data.files;
}

export async function uploadFile(request: UploadFileRequest): Promise<Operation> {
  const formData = new FormData();
  formData.append('file', request.file);
  if (request.config) {
    formData.append('config', JSON.stringify(request.config));
  }

  const response = await fetch(
    `${API_BASE}/stores/${encodeURIComponent(request.storeName)}/files`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteFile(storeName: string, fileName: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/stores/${encodeURIComponent(storeName)}/files/${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
}

// Search API
export async function search(request: SearchRequest): Promise<SearchResponse> {
  return fetchApi<SearchResponse>('/search', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// Operations API
export async function getOperation(operationName: string): Promise<Operation> {
  return fetchApi<Operation>(`/operations/${encodeURIComponent(operationName)}`);
}

export async function waitForOperation(
  operationName: string,
  pollInterval = 2000
): Promise<Operation> {
  let operation = await getOperation(operationName);

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    operation = await getOperation(operationName);
  }

  return operation;
}
