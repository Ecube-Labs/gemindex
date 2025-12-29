import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import type { GemindexConfig } from '../types/index.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const DEFAULT_CONFIG: Partial<GemindexConfig> = {
  version: 1,
  collect: {
    include: [],
    exclude: [],
  },
  sync: {
    delete: false,
    concurrency: 8,
  },
  api: {
    endpoint: 'http://localhost:4000',
  },
};

/**
 * Load and validate config file.
 */
export function loadConfig(configPath: string): GemindexConfig {
  const fullPath = path.resolve(configPath);

  if (!fs.existsSync(fullPath)) {
    throw new ConfigError(`Config file not found: ${fullPath}`);
  }

  let content: string;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    throw new ConfigError(
      `Failed to read config file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  let parsed: Partial<GemindexConfig>;
  try {
    parsed = parseYaml(content) as Partial<GemindexConfig>;
  } catch (error) {
    throw new ConfigError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate required fields
  if (!parsed.store) {
    throw new ConfigError('Missing required field: store');
  }

  if (!parsed.collect?.include?.length) {
    throw new ConfigError(
      'Missing required field: collect.include (must have at least one pattern)'
    );
  }

  // Merge with defaults
  return {
    version: parsed.version ?? DEFAULT_CONFIG.version!,
    store: parsed.store,
    collect: {
      include: parsed.collect.include,
      exclude: parsed.collect.exclude ?? DEFAULT_CONFIG.collect!.exclude!,
    },
    sync: {
      delete: parsed.sync?.delete ?? DEFAULT_CONFIG.sync!.delete!,
      concurrency: parsed.sync?.concurrency ?? DEFAULT_CONFIG.sync!.concurrency!,
    },
    api: {
      endpoint: parsed.api?.endpoint ?? DEFAULT_CONFIG.api!.endpoint!,
      token_env: parsed.api?.token_env,
    },
  };
}
