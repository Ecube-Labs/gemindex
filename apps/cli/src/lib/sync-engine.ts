import type { LocalFile, RemoteFile, SyncPlan } from '../types/index.js';

/**
 * Convert a file path to a safe filename by replacing path separators with underscores.
 * e.g., "docs/guide.md" → "docs_guide.md"
 */
function pathToFilename(relativePath: string): string {
  return relativePath.replace(/[/\\]/g, '_');
}

/**
 * Build a sync plan by comparing local and remote files.
 */
export function buildSyncPlan(
  localFiles: LocalFile[],
  localHashes: Map<string, string>,
  remoteFiles: RemoteFile[],
  deleteRemote: boolean
): SyncPlan {
  const plan: SyncPlan = {
    uploads: [],
    skips: [],
    deletes: [],
  };

  // Build map of remote files by originalFileName
  const remoteByName = new Map<string, RemoteFile>();
  for (const remote of remoteFiles) {
    if (remote.originalFileName) {
      remoteByName.set(remote.originalFileName, remote);
    }
  }

  // Process local files
  for (const local of localFiles) {
    const localHash = localHashes.get(local.absolutePath);
    // Convert local path to filename format for comparison (e.g., "docs/guide.md" → "docs_guide.md")
    const localFileName = pathToFilename(local.relativePath);
    const remote = remoteByName.get(localFileName);

    if (!remote) {
      // File doesn't exist remotely - upload
      plan.uploads.push({
        type: 'upload',
        localFile: local,
        reason: 'new file',
      });
    } else if (remote.sha256 && localHash && remote.sha256 !== localHash) {
      // File exists but hash differs - upload
      plan.uploads.push({
        type: 'upload',
        localFile: local,
        remoteFile: remote,
        reason: 'content changed',
      });
    } else if (!remote.sha256) {
      // Remote file has no hash (legacy) - upload to update
      plan.uploads.push({
        type: 'upload',
        localFile: local,
        remoteFile: remote,
        reason: 'missing remote hash',
      });
    } else {
      // Hashes match - skip
      plan.skips.push({
        type: 'skip',
        localFile: local,
        remoteFile: remote,
        reason: 'unchanged',
      });
    }

    // Remove from map to track what's left
    remoteByName.delete(localFileName);
  }

  // Remaining remote files are orphans
  if (deleteRemote) {
    for (const [, remote] of remoteByName) {
      plan.deletes.push({
        type: 'delete',
        remoteFile: remote,
        reason: 'not in local',
      });
    }
  }

  return plan;
}
