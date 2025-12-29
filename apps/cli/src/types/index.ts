// CLI Types

export interface LocalFile {
  relativePath: string; // Used as originalFileName for sync
  absolutePath: string;
  size: number;
}

export interface RemoteFile {
  name: string; // Full document path
  displayName: string; // Gemini-assigned display name
  originalFileName: string; // Our originalFileName from customMetadata
  sha256?: string; // SHA256 hash from customMetadata
  state: string;
}

export interface SyncAction {
  type: 'upload' | 'skip' | 'delete';
  localFile?: LocalFile;
  remoteFile?: RemoteFile;
  reason: string;
}

export interface SyncPlan {
  uploads: SyncAction[];
  skips: SyncAction[];
  deletes: SyncAction[];
}

export interface GemindexConfig {
  version: number;
  store: string;
  collect: {
    include: string[];
    exclude?: string[];
  };
  sync?: {
    delete?: boolean;
    concurrency?: number;
  };
  api?: {
    endpoint?: string;
    token_env?: string;
  };
}

export interface UploadResult {
  action: SyncAction;
  success: boolean;
  error?: string;
  retries: number;
  cancelled?: boolean;
}

export interface DeleteResult {
  action: SyncAction;
  success: boolean;
  error?: string;
}
