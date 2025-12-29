import fg from 'fast-glob';
import path from 'path';
import type { LocalFile } from '../types/index.js';

/**
 * Scan files matching glob patterns.
 */
export async function scanFiles(
  baseDir: string,
  include: string[],
  exclude: string[] = []
): Promise<LocalFile[]> {
  // Convert patterns to be relative to baseDir
  const patterns = include.map((p) => (path.isAbsolute(p) ? p : p));

  const ignorePatterns = exclude.map((p) => (path.isAbsolute(p) ? p : p));

  const entries = await fg(patterns, {
    cwd: baseDir,
    ignore: ignorePatterns,
    stats: true,
    absolute: false,
    onlyFiles: true,
    dot: false, // Don't match dotfiles by default
  });

  return entries.map((entry) => ({
    relativePath: typeof entry === 'string' ? entry : entry.path,
    absolutePath: path.join(baseDir, typeof entry === 'string' ? entry : entry.path),
    size: typeof entry === 'string' ? 0 : (entry.stats?.size ?? 0),
  }));
}
