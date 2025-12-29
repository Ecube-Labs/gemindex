// Gemini File Search API Types

export interface FileSearchStore {
  name: string;
  displayName: string;
  createTime: string;
  protected?: boolean;
}

export interface FileSearchStoreFile {
  name: string;
  displayName: string;
  originalDisplayName?: string; // Original filename from Files API
  sha256?: string; // SHA256 hash for sync comparison
  state:
    | 'STATE_PENDING_PROCESSING'
    | 'STATE_ACTIVE'
    | 'STATE_FAILED'
    | 'PROCESSING'
    | 'ACTIVE'
    | 'FAILED';
  createTime: string;
  updateTime: string;
  sizeBytes?: string;
  mimeType?: string;
  error?: {
    code: number;
    message: string;
  };
  metadata?: CustomMetadata[];
}

export interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

export interface Operation {
  name: string;
  done: boolean;
  error?: {
    code: number;
    message: string;
  };
  response?: unknown;
}

export interface ChunkingConfig {
  whiteSpaceConfig?: {
    maxTokensPerChunk: number;
    maxOverlapTokens: number;
  };
}

export interface FileUploadConfig {
  displayName?: string;
  chunkingConfig?: ChunkingConfig;
  customMetadata?: CustomMetadata[];
}

// API Request/Response Types

export interface CreateStoreRequest {
  displayName: string;
}

export interface CreateStoreResponse {
  store: FileSearchStore;
}

export interface ListStoresResponse {
  stores: FileSearchStore[];
}

export interface ListFilesResponse {
  files: FileSearchStoreFile[];
}

export interface UploadFileRequest {
  storeName: string;
  file: File;
  config?: FileUploadConfig;
}

export interface SearchRequest {
  storeName: string;
  query: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface SearchPreset {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
}

export interface GroundingSource {
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

export interface SearchResponse {
  text: string;
  sources: GroundingSource[];
  supports: GroundingSupport[];
}
