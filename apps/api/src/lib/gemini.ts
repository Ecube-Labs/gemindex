import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return apiKey;
}

interface ApiError {
  error?: { message?: string };
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const url = `${GEMINI_API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${apiKey}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({ error: { message: 'Unknown error' } }))) as ApiError;
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Types
export interface FileSearchStore {
  name?: string;
  displayName?: string;
  createTime?: string;
  updateTime?: string;
  activeDocumentsCount?: string;
  pendingDocumentsCount?: string;
  failedDocumentsCount?: string;
  sizeBytes?: string;
}

export interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

export interface FileSearchStoreFile {
  name: string;
  displayName?: string;
  originalDisplayName?: string; // Original filename (from customMetadata or Files API)
  sha256?: string; // SHA256 hash for sync comparison (from customMetadata)
  state?: string;
  createTime?: string;
  updateTime?: string;
  sizeBytes?: string;
  mimeType?: string;
  uri?: string;
  customMetadata?: CustomMetadata[];
  error?: {
    code: number;
    message: string;
  };
}

export interface Operation {
  name?: string;
  done?: boolean;
  error?: {
    code?: number;
    message?: string;
  };
  response?: unknown;
}

// Store operations
export async function listStores(): Promise<FileSearchStore[]> {
  const data = await fetchApi<{ fileSearchStores?: FileSearchStore[] }>('/fileSearchStores');
  return data.fileSearchStores ?? [];
}

export async function createStore(displayName: string): Promise<FileSearchStore> {
  return fetchApi<FileSearchStore>('/fileSearchStores', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export async function getStore(name: string): Promise<FileSearchStore> {
  const storeName = name.startsWith('fileSearchStores/') ? name : `fileSearchStores/${name}`;
  return fetchApi<FileSearchStore>(`/${storeName}`);
}

export async function deleteStore(name: string, force = false): Promise<void> {
  const storeName = name.startsWith('fileSearchStores/') ? name : `fileSearchStores/${name}`;
  await fetchApi<unknown>(`/${storeName}${force ? '?force=true' : ''}`, {
    method: 'DELETE',
  });
}

// Helper to extract original filename from customMetadata
function getOriginalFileName(customMetadata?: CustomMetadata[]): string | undefined {
  if (!customMetadata) return undefined;
  const meta = customMetadata.find((m) => m.key === 'originalFileName');
  return meta?.stringValue;
}

// Helper to extract sha256 hash from customMetadata
function getSha256(customMetadata?: CustomMetadata[]): string | undefined {
  if (!customMetadata) return undefined;
  const meta = customMetadata.find((m) => m.key === 'sha256');
  return meta?.stringValue;
}

// File operations (documents in Gemini API terminology)
export async function listFiles(storeName: string): Promise<FileSearchStoreFile[]> {
  const name = storeName.startsWith('fileSearchStores/')
    ? storeName
    : `fileSearchStores/${storeName}`;
  try {
    const data = await fetchApi<{ documents?: FileSearchStoreFile[] }>(`/${name}/documents`);
    const documents = data.documents ?? [];

    // Extract original filename and sha256 from customMetadata
    return documents.map((doc) => ({
      ...doc,
      originalDisplayName: getOriginalFileName(doc.customMetadata),
      sha256: getSha256(doc.customMetadata),
    }));
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

export interface UploadConfig {
  displayName?: string;
}

export async function uploadFile(
  storeName: string,
  filePath: string,
  config?: UploadConfig
): Promise<Operation> {
  const apiKey = getApiKey();
  const name = storeName.startsWith('fileSearchStores/')
    ? storeName
    : `fileSearchStores/${storeName}`;

  const fileContent = fs.readFileSync(filePath);
  const displayName = config?.displayName || path.basename(filePath);
  // Use displayName for mimeType detection since filePath might be a temp file without extension
  const mimeType = getMimeType(displayName);
  // Calculate SHA256 hash for sync comparison
  const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

  // Step 0: Delete existing files with the same originalFileName (overwrite behavior)
  const existingFiles = await listFiles(storeName);
  const duplicates = existingFiles.filter((f) => f.originalDisplayName === displayName);
  await Promise.all(duplicates.map((f) => deleteFile(storeName, f.name)));

  // Step 1: Upload file to Files API first
  const startUploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;

  const startResponse = await fetch(startUploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(fileContent.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: { displayName },
    }),
  });

  if (!startResponse.ok) {
    const errorText = await startResponse.text();
    console.error('Upload start failed:', startResponse.status, errorText);
    const errorData = JSON.parse(errorText).error || { message: 'Upload start failed' };
    throw new Error(errorData.message || `Upload start failed: HTTP ${startResponse.status}`);
  }

  const uploadUrl = startResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('No upload URL received');
  }

  // Step 2: Upload the file content
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(fileContent.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: fileContent,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('Upload failed:', uploadResponse.status, errorText);
    const errorData = JSON.parse(errorText).error || { message: 'Upload failed' };
    throw new Error(errorData.message || `Upload failed: HTTP ${uploadResponse.status}`);
  }

  const uploadResponseText = await uploadResponse.text();

  let uploadedFile: { file: { name: string } };
  try {
    uploadedFile = JSON.parse(uploadResponseText) as { file: { name: string } };
  } catch {
    throw new Error('Failed to parse upload response');
  }

  if (!uploadedFile.file?.name) {
    throw new Error('Upload response missing file name');
  }

  // Step 3: Import file to store using :importFile endpoint with custom metadata
  const importUrl = `${GEMINI_API_BASE}/${name}:importFile?key=${apiKey}`;

  const importResponse = await fetch(importUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name: uploadedFile.file.name,
      custom_metadata: [
        { key: 'originalFileName', string_value: displayName },
        { key: 'uploadedAt', string_value: new Date().toISOString() },
        { key: 'sha256', string_value: fileHash },
      ],
    }),
  });

  const importResponseText = await importResponse.text();

  if (!importResponse.ok) {
    let errorMessage = 'Import failed';
    try {
      const errorData = JSON.parse(importResponseText);
      errorMessage = errorData.error?.message || `Import failed: HTTP ${importResponse.status}`;
    } catch {
      errorMessage = importResponseText || `Import failed: HTTP ${importResponse.status}`;
    }
    throw new Error(errorMessage);
  }

  let result: Operation;
  try {
    result = JSON.parse(importResponseText) as Operation;
    // If response field exists, the operation is complete (Gemini API may not include done field)
    if (result.response && result.done === undefined) {
      result.done = true;
    }
  } catch {
    // If response is empty but status is OK, create a minimal operation response
    result = { done: true };
  }

  return result;
}

export async function deleteFile(storeName: string, documentName: string): Promise<void> {
  // documentName can be:
  // - Full path: "fileSearchStores/{store}/documents/{id}"
  // - Document ID only: "{id}"
  let fullPath: string;
  if (documentName.startsWith('fileSearchStores/')) {
    fullPath = documentName;
  } else if (documentName.startsWith('documents/')) {
    const name = storeName.startsWith('fileSearchStores/')
      ? storeName
      : `fileSearchStores/${storeName}`;
    fullPath = `${name}/${documentName}`;
  } else {
    const name = storeName.startsWith('fileSearchStores/')
      ? storeName
      : `fileSearchStores/${storeName}`;
    fullPath = `${name}/documents/${documentName}`;
  }

  await fetchApi<unknown>(`/${fullPath}?force=true`, {
    method: 'DELETE',
  });
}

// Operation polling
export async function getOperation(operationName: string): Promise<Operation> {
  // Operation names can be:
  // - fileSearchStores/{store}/operations/{op} (for file import operations)
  // - operations/{op} (for general operations)
  // Just use the name as-is if it contains 'operations/'
  const name = operationName.includes('operations/')
    ? operationName
    : `operations/${operationName}`;
  const operation = await fetchApi<Operation>(`/${name}`);

  // If response field exists, the operation is complete (Gemini API may not include done field)
  if (operation.response && operation.done === undefined) {
    operation.done = true;
  }

  return operation;
}

export async function waitForOperation(
  operation: Operation,
  pollInterval = 2000
): Promise<Operation> {
  if (!operation.name) return operation;

  let currentOp = operation;
  while (!currentOp.done) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    currentOp = await getOperation(operation.name);
  }

  return currentOp;
}

// Search
export interface SearchConfig {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface GroundingChunk {
  title: string;
  text: string;
  fileSearchStore: string;
}

export interface GroundingSupport {
  startIndex: number;
  endIndex: number;
  text: string;
  chunkIndices: number[];
}

export interface SearchResult {
  text: string;
  sources: GroundingChunk[];
  supports: GroundingSupport[];
}

export async function search(
  storeName: string,
  query: string,
  config?: SearchConfig
): Promise<SearchResult> {
  const model = config?.model ?? 'gemini-2.5-flash';
  const name = storeName.startsWith('fileSearchStores/')
    ? storeName
    : `fileSearchStores/${storeName}`;

  // Get file list to map file IDs to original display names
  const files = await listFiles(storeName);
  const fileIdToName = new Map<string, string>();
  files.forEach((f) => {
    if (f.displayName && f.originalDisplayName) {
      fileIdToName.set(f.displayName, f.originalDisplayName);
    }
  });

  interface GroundingMetadata {
    groundingChunks?: Array<{
      retrievedContext?: {
        title?: string;
        text?: string;
        fileSearchStore?: string;
      };
    }>;
    groundingSupports?: Array<{
      segment?: {
        startIndex?: number;
        endIndex?: number;
        text?: string;
      };
      groundingChunkIndices?: number[];
    }>;
  }

  // Build contents with optional system instruction
  const contents: Array<{ role?: string; parts: Array<{ text: string }> }> = [];
  if (config?.systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: config.systemPrompt }] });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I will follow these instructions.' }],
    });
  }
  contents.push({ parts: [{ text: query }] });

  // Build generation config
  const generationConfig: Record<string, unknown> = {};
  if (config?.temperature !== undefined) generationConfig.temperature = config.temperature;
  if (config?.topP !== undefined) generationConfig.topP = config.topP;
  if (config?.topK !== undefined) generationConfig.topK = config.topK;
  if (config?.maxOutputTokens !== undefined)
    generationConfig.maxOutputTokens = config.maxOutputTokens;

  const requestBody: Record<string, unknown> = {
    contents,
    tools: [
      {
        fileSearch: {
          fileSearchStoreNames: [name],
        },
      },
    ],
  };

  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  const response = await fetchApi<{
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: GroundingMetadata;
    }>;
  }>(`/models/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  const candidate = response.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';

  // Extract grounding chunks as sources with original file names
  const sources: GroundingChunk[] =
    candidate?.groundingMetadata?.groundingChunks
      ?.map((chunk) => chunk.retrievedContext)
      .filter((ctx): ctx is NonNullable<typeof ctx> => !!ctx)
      .map((ctx) => ({
        // Map file ID to original display name
        title: (ctx.title && fileIdToName.get(ctx.title)) || ctx.title || 'Unknown',
        text: ctx.text ?? '',
        fileSearchStore: ctx.fileSearchStore ?? '',
      })) ?? [];

  // Extract grounding supports for inline citations
  const supports: GroundingSupport[] =
    candidate?.groundingMetadata?.groundingSupports
      ?.map((support) => ({
        startIndex: support.segment?.startIndex ?? 0,
        endIndex: support.segment?.endIndex ?? 0,
        text: support.segment?.text ?? '',
        chunkIndices: support.groundingChunkIndices ?? [],
      }))
      .filter((s) => s.text.length > 0) ?? [];

  return {
    text,
    sources,
    supports,
  };
}

// Utility functions
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/plain', // Gemini doesn't support text/markdown, use text/plain
    '.html': 'text/html',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
