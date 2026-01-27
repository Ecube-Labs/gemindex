#!/usr/bin/env node
import { startProxy } from './proxy.js';
import { ensureAuthenticated, clearCookie } from './auth.js';

const DEFAULT_HOST = 'http://localhost:4000';

interface ParsedArgs {
  host: string;
  clear: boolean;
  help: boolean;
  noAuth: boolean;
  browserPath?: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let host = DEFAULT_HOST;
  let clear = false;
  let help = false;
  let noAuth = false;
  let browserPath: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || DEFAULT_HOST;
    } else if (arg.startsWith('--browser-path=')) {
      browserPath = arg.split('=').slice(1).join('='); // Handle paths with '='
    } else if (arg === '--clear' || arg === '-c') {
      clear = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--no-auth') {
      noAuth = true;
    }
  }

  // Auto-detect localhost - skip auth
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    noAuth = true;
  }

  return { host, clear, help, noAuth, browserPath };
}

function printHelp(): void {
  console.log(`
@gemindex/mcp - MCP stdio proxy for GemIndex

Usage:
  gemindex-mcp [options]

Options:
  --host=<url>          Target GemIndex server URL
                        Default: ${DEFAULT_HOST}
  --browser-path=<path> Custom browser executable path for OAuth login
                        Example: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  --no-auth             Skip OAuth authentication (auto-enabled for localhost)
  --clear, -c           Clear cached OAuth cookie and re-authenticate
  --help, -h            Show this help message

Configuration (.mcp.json):
  {
    "mcpServers": {
      "gemindex": {
        "type": "stdio",
        "command": "npx",
        "args": ["@gemindex/mcp", "--host=https://gemindex-stage.ecubelabs.xyz"]
      }
    }
  }

Cookie Storage:
  ~/.gemindex/cookies.json
`);
}

async function main(): Promise<void> {
  const { host, clear, help, noAuth, browserPath } = parseArgs();

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (clear) {
    clearCookie(host);
  }

  try {
    let cookie: string | undefined;

    if (!noAuth) {
      // Ensure we have valid OAuth cookie
      cookie = await ensureAuthenticated(host, browserPath);
    } else {
      console.error('Skipping OAuth authentication');
    }

    // Start MCP proxy server (stdio)
    await startProxy(host, cookie);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
