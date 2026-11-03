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

export class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof GeminiApiError && error.status === 404;
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
    throw new GeminiApiError(
      errorData.error?.message || `HTTP ${response.status}`,
      response.status
    );
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

function toStoreName(storeName: string): string {
  return storeName.startsWith('fileSearchStores/') ? storeName : `fileSearchStores/${storeName}`;
}

export async function getStore(name: string): Promise<FileSearchStore> {
  return fetchApi<FileSearchStore>(`/${toStoreName(name)}`);
}

export async function deleteStore(name: string, force = false): Promise<void> {
  await fetchApi<unknown>(`/${toStoreName(name)}${force ? '?force=true' : ''}`, {
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

// documents.list returns at most 10 per page by default; 20 is the documented maximum.
const DOCUMENTS_PAGE_SIZE = 20;

// File operations (documents in Gemini API terminology)
// Throws on failure: callers must not mistake an API error for an empty store.
export async function listFiles(storeName: string): Promise<FileSearchStoreFile[]> {
  const name = toStoreName(storeName);
  const allDocuments: FileSearchStoreFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: String(DOCUMENTS_PAGE_SIZE) });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await fetchApi<{
      documents?: FileSearchStoreFile[];
      nextPageToken?: string;
    }>(`/${name}/documents?${params.toString()}`);

    allDocuments.push(...(data.documents ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Extract original filename and sha256 from customMetadata
  return allDocuments.map((doc) => ({
    ...doc,
    originalDisplayName: getOriginalFileName(doc.customMetadata),
    sha256: getSha256(doc.customMetadata),
  }));
}

// Per-store document metadata cache for search source enrichment (documentName, createTime)
// that grounding chunks do not carry. Stale-while-revalidate: concurrent misses share one
// in-flight listing, and the previous listing stays usable while a refresh runs.
const METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
// After an upload/delete, new documents may still be indexing, so listings fetched shortly
// after a mutation expire quickly. This also caps refreshes to one per window during a sync.
const METADATA_CACHE_TTL_AFTER_MUTATION_MS = 15 * 1000;
const METADATA_MUTATION_WINDOW_MS = 2 * 60 * 1000;
// A failed listing is not retried by every search; it backs off for this long.
const METADATA_FAILURE_COOLDOWN_MS = 30 * 1000;
// How long a search waits for an in-flight listing after generation before using stale data.
const METADATA_WAIT_BUDGET_MS = 1000;

interface MetadataCacheEntry {
  expiresAt: number;
  files: Promise<FileSearchStoreFile[]>;
  /** Last successful listing (possibly stale), usable without waiting */
  resolved?: FileSearchStoreFile[];
}

const metadataCache = new Map<string, MetadataCacheEntry>();
const lastMutationAt = new Map<string, number>();

function getCachedFiles(storeName: string): Promise<FileSearchStoreFile[]> {
  const key = toStoreName(storeName);
  const cached = metadataCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.files;

  const recentlyMutated = now - (lastMutationAt.get(key) ?? 0) < METADATA_MUTATION_WINDOW_MS;
  const files = listFiles(key);
  const entry: MetadataCacheEntry = {
    expiresAt:
      now + (recentlyMutated ? METADATA_CACHE_TTL_AFTER_MUTATION_MS : METADATA_CACHE_TTL_MS),
    files,
    resolved: cached?.resolved,
  };
  metadataCache.set(key, entry);
  files.then(
    (resolved) => {
      entry.resolved = resolved;
    },
    (error: unknown) => {
      console.error('Failed to refresh document metadata cache:', error);
      entry.expiresAt = Date.now() + METADATA_FAILURE_COOLDOWN_MS;
    }
  );
  return files;
}

function invalidateMetadataCache(storeName: string): void {
  const key = toStoreName(storeName);
  const now = Date.now();
  lastMutationAt.set(key, now);
  // Debounced: expire soon rather than immediately, keeping the stale listing meanwhile
  const entry = metadataCache.get(key);
  if (entry) {
    entry.expiresAt = Math.min(entry.expiresAt, now + METADATA_CACHE_TTL_AFTER_MUTATION_MS);
  }
}

/** Resolves to the value, or undefined if it does not settle successfully within `ms`. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      }
    );
  });
}

// Deletes the given documents if they still exist and belong to this file. Names come from
// the caller's earlier listing, so they may already be gone (404 is fine) — e.g. on a retry
// after a partial failure — and are re-checked so a stray name cannot delete another file.
async function deleteReplacedDocuments(
  storeName: string,
  displayName: string,
  documentNames: string[]
): Promise<void> {
  await Promise.all(
    documentNames.map(async (documentName) => {
      const fullName = toDocumentName(storeName, documentName);
      if (!fullName.startsWith(`${toStoreName(storeName)}/documents/`)) {
        console.warn(`Skipping replace of ${fullName}: it belongs to another store`);
        return;
      }
      let doc: FileSearchStoreFile;
      try {
        doc = await fetchApi<FileSearchStoreFile>(`/${fullName}`);
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      if (getOriginalFileName(doc.customMetadata) !== displayName) {
        console.warn(`Skipping replace of ${fullName}: it is not a version of "${displayName}"`);
        return;
      }
      await deleteFile(storeName, fullName).catch((error: unknown) => {
        if (!isNotFound(error)) throw error;
      });
    })
  );
}

export interface UploadConfig {
  displayName?: string;
  customMetadata?: Record<string, string | number>;
  /**
   * Document names to replace. When provided (even empty), the caller already knows
   * which existing documents to overwrite, so the full-store scan is skipped.
   */
  replaceDocuments?: string[];
}

export async function uploadFile(
  storeName: string,
  filePath: string,
  config?: UploadConfig
): Promise<Operation> {
  const apiKey = getApiKey();
  const name = toStoreName(storeName);

  const fileContent = fs.readFileSync(filePath);
  const displayName = config?.displayName || path.basename(filePath);
  // Use displayName for mimeType detection since filePath might be a temp file without extension
  const mimeType = getMimeType(displayName);
  // Calculate SHA256 hash for sync comparison
  const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

  // Step 0: Delete existing files with the same originalFileName (overwrite behavior).
  // Callers that already know the target documents (e.g. CLI sync) skip the O(N) scan.
  if (config?.replaceDocuments) {
    await deleteReplacedDocuments(storeName, displayName, config.replaceDocuments);
  } else {
    const duplicates = (await listFiles(storeName)).filter(
      (f) => f.originalDisplayName === displayName
    );
    await Promise.all(
      duplicates.map((f) =>
        deleteFile(storeName, f.name).catch((error: unknown) => {
          if (!isNotFound(error)) throw error;
        })
      )
    );
  }

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

  // Build metadata array: user metadata first, then system metadata (which takes precedence)
  const reservedKeys = new Set(['originalFileName', 'uploadedAt', 'sha256']);
  const metadataEntries: Array<{ key: string; string_value?: string; numeric_value?: number }> = [];

  // Add user-provided metadata (excluding reserved keys)
  if (config?.customMetadata) {
    for (const [key, value] of Object.entries(config.customMetadata)) {
      if (reservedKeys.has(key)) {
        console.warn(
          `Warning: Skipping reserved metadata key "${key}" - system value will be used`
        );
        continue;
      }
      if (typeof value === 'string') {
        metadataEntries.push({ key, string_value: value });
      } else if (typeof value === 'number') {
        metadataEntries.push({ key, numeric_value: value });
      }
    }
  }

  // Add system metadata (always included, takes precedence)
  metadataEntries.push(
    { key: 'originalFileName', string_value: displayName },
    { key: 'uploadedAt', string_value: new Date().toISOString() },
    { key: 'sha256', string_value: fileHash }
  );

  const importResponse = await fetch(importUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name: uploadedFile.file.name,
      custom_metadata: metadataEntries,
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

  invalidateMetadataCache(storeName);
  return result;
}

// documentName can be a full path ("fileSearchStores/{store}/documents/{id}"),
// "documents/{id}", or a bare document ID.
function toDocumentName(storeName: string, documentName: string): string {
  if (documentName.startsWith('fileSearchStores/')) return documentName;
  if (documentName.startsWith('documents/')) return `${toStoreName(storeName)}/${documentName}`;
  return `${toStoreName(storeName)}/documents/${documentName}`;
}

export async function deleteFile(storeName: string, documentName: string): Promise<void> {
  await fetchApi<unknown>(`/${toDocumentName(storeName, documentName)}?force=true`, {
    method: 'DELETE',
  });
  invalidateMetadataCache(storeName);
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
  /** Gemini 3+ thinking level. Defaults to MINIMAL on models that support it. */
  thinkingLevel?: ThinkingLevel;
}

export const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

// MINIMAL cut File Search TTFT ~40% on 3.6-flash (14.0s -> 8.5s) with no measurable quality
// loss in blind eval. gemini-3.7/3.8-flash reject MINIMAL (HTTP 400), and 2.x models use
// thinkingBudget instead, so the default only applies to models verified to accept it.
// Optional "-preview..." suffix covers preview/dated variants of the same families.
const MINIMAL_THINKING_MODELS =
  /^(gemini-3\.[56]-flash(-lite)?|gemini-3\.1-flash-lite|gemini-flash-lite-latest)(-preview[\w.-]*)?$/;

function defaultThinkingLevel(model: string): ThinkingLevel | undefined {
  return MINIMAL_THINKING_MODELS.test(model) ? 'MINIMAL' : undefined;
}

export interface GroundingChunk {
  title: string;
  text: string;
  fileSearchStore: string;

  // Additional metadata fields
  documentName?: string; // Document resource name (for API links)
  displayName?: string; // Gemini-assigned displayName (for debugging)
  mimeType?: string; // File MIME type
  uploadedAt?: string; // Upload timestamp
  createTime?: string; // Document creation time
  sourceUrl?: string; // Original URL (if provided during upload)
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

// Quality over speed: flash beat flash-lite in blind eval (9/12 wins) at ~2x the latency
export const DEFAULT_SEARCH_MODEL = 'gemini-3.6-flash';

export async function search(
  storeName: string,
  query: string,
  config?: SearchConfig
): Promise<SearchResult> {
  // Accept both "gemini-x" and "models/gemini-x" ids
  const model = (config?.model ?? DEFAULT_SEARCH_MODEL).replace(/^models\//, '');
  const name = toStoreName(storeName);

  // Start (or reuse) the metadata listing now so it runs in parallel with generation.
  // Rejections are handled inside getCachedFiles; settleWithin below never throws.
  const metadataPromise = getCachedFiles(storeName);

  interface RetrievedContext {
    uri?: string;
    title?: string;
    text?: string;
    fileSearchStore?: string;
    customMetadata?: CustomMetadata[];
  }

  interface GroundingMetadata {
    groundingChunks?: Array<{ retrievedContext?: RetrievedContext }>;
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
  const thinkingLevel = config?.thinkingLevel ?? defaultThinkingLevel(model);
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };

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

  // Map grounding chunks to sources. Chunks carry the document's customMetadata
  // (originalFileName, uploadedAt, ...); documentName/createTime come from the store listing
  // started before generation, which has usually finished by now:
  // - chunks without our metadata (uploaded outside GemIndex) wait for the listing.
  // - otherwise wait at most METADATA_WAIT_BUDGET_MS, then fall back to the last
  //   (possibly stale) listing so a cold cache never adds O(N) latency.
  const contexts =
    candidate?.groundingMetadata?.groundingChunks
      ?.map((chunk) => chunk.retrievedContext)
      .filter((ctx): ctx is RetrievedContext => !!ctx) ?? [];

  let cachedFiles: FileSearchStoreFile[] | undefined;
  if (contexts.length > 0) {
    const needsFallback = contexts.some((ctx) => !getOriginalFileName(ctx.customMetadata));
    cachedFiles =
      (needsFallback
        ? await metadataPromise.catch(() => undefined)
        : await settleWithin(metadataPromise, METADATA_WAIT_BUDGET_MS)) ??
      metadataCache.get(name)?.resolved;
  }

  const fallbackByDisplayName = new Map<string, FileSearchStoreFile>();
  for (const f of cachedFiles ?? []) {
    if (f.displayName) fallbackByDisplayName.set(f.displayName, f);
  }

  const sources: GroundingChunk[] = contexts.map((ctx) => {
    const fallback = ctx.title ? fallbackByDisplayName.get(ctx.title) : undefined;
    const customMetadata = ctx.customMetadata ?? fallback?.customMetadata;
    const findMeta = (key: string) => customMetadata?.find((m) => m.key === key)?.stringValue;
    const originalFileName = getOriginalFileName(customMetadata);
    const documentName = fallback?.name ?? (ctx.uri?.includes('/documents/') ? ctx.uri : undefined);

    return {
      // Map file ID to original display name
      title: originalFileName || ctx.title || 'Unknown',
      text: ctx.text ?? '',
      fileSearchStore: ctx.fileSearchStore ?? '',
      documentName,
      displayName: ctx.title,
      mimeType:
        fallback?.mimeType ?? (originalFileName ? getMimeType(originalFileName) : undefined),
      uploadedAt: findMeta('uploadedAt'),
      createTime: fallback?.createTime,
      sourceUrl: findMeta('sourceUrl'),
    };
  });

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
