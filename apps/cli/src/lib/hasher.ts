import fs from 'fs';
import crypto from 'crypto';
import type { LocalFile } from '../types/index.js';

/**
 * Compute SHA256 hash of a file using streams for memory efficiency.
 */
export async function computeSha256(filePath: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    const abortHandler = () => {
      stream.destroy();
      reject(new Error('Aborted'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      signal?.removeEventListener('abort', abortHandler);
      resolve(hash.digest('hex'));
    });
    stream.on('error', (error) => {
      signal?.removeEventListener('abort', abortHandler);
      reject(error);
    });
  });
}

/**
 * Compute hashes for multiple files.
 * Returns a Map of absolutePath -> sha256
 */
export async function computeHashes(
  files: LocalFile[],
  signal?: AbortSignal
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();

  for (const file of files) {
    if (signal?.aborted) {
      break;
    }
    const hash = await computeSha256(file.absolutePath, signal);
    hashes.set(file.absolutePath, hash);
  }

  return hashes;
}
