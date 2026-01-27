import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';
import type { LocalFile, CustomMetadata, CustomMetadataValue } from '../types/index.js';

const METADATA_SUFFIX = '.metadata.json';

/**
 * Get the metadata file path for a given file.
 * e.g., "report.pdf" → "report.metadata.json"
 */
function getMetadataPath(filePath: string): string {
  const ext = path.extname(filePath);
  const baseName = filePath.slice(0, -ext.length || undefined);
  return baseName + METADATA_SUFFIX;
}

/**
 * Convert a value to Gemini-compatible metadata value.
 * - string/number: keep as-is
 * - boolean: convert to "true"/"false"
 * - object/array: skip (return undefined)
 */
function toMetadataValue(value: unknown): CustomMetadataValue | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // Skip objects, arrays, null, undefined
  return undefined;
}

/**
 * Load and parse metadata from a .metadata.json file.
 * Returns undefined if file doesn't exist or has invalid JSON.
 */
function loadMetadataFile(metadataPath: string): CustomMetadata | undefined {
  if (!fs.existsSync(metadataPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Convert to flat metadata object (string/number values only)
    const metadata: CustomMetadata = {};
    for (const [key, value] of Object.entries(parsed)) {
      const converted = toMetadataValue(value);
      if (converted !== undefined) {
        metadata[key] = converted;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  } catch (error) {
    // Log warning but don't fail - continue without metadata
    console.warn(
      `Warning: Failed to parse metadata file ${metadataPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return undefined;
  }
}

/**
 * Scan files matching glob patterns.
 * Automatically excludes .metadata.json files and loads their content as metadata.
 *
 * @param enableMetadata - If true (default), load metadata from .metadata.json files
 */
export async function scanFiles(
  baseDir: string,
  include: string[],
  exclude: string[] = [],
  enableMetadata: boolean = true
): Promise<LocalFile[]> {
  // Convert patterns to be relative to baseDir
  const patterns = include.map((p) => (path.isAbsolute(p) ? p : p));

  // Always exclude metadata files from upload
  const ignorePatterns = [
    ...exclude.map((p) => (path.isAbsolute(p) ? p : p)),
    `**/*${METADATA_SUFFIX}`,
  ];

  const entries = await fg(patterns, {
    cwd: baseDir,
    ignore: ignorePatterns,
    stats: true,
    absolute: false,
    onlyFiles: true,
    dot: false, // Don't match dotfiles by default
  });

  return entries.map((entry) => {
    const relativePath = typeof entry === 'string' ? entry : entry.path;
    const absolutePath = path.join(baseDir, relativePath);
    const size = typeof entry === 'string' ? 0 : (entry.stats?.size ?? 0);

    // Load metadata if enabled
    let metadata: CustomMetadata | undefined;
    if (enableMetadata) {
      const metadataPath = path.join(baseDir, getMetadataPath(relativePath));
      metadata = loadMetadataFile(metadataPath);
    }

    return {
      relativePath,
      absolutePath,
      size,
      metadata,
    };
  });
}
