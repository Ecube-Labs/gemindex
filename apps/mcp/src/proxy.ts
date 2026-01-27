import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const COOKIE_NAME = '_oauth2_proxy';

export async function startProxy(host: string, cookie?: string): Promise<void> {
  const mcpUrl = `${host}/mcp`;
  console.error(`Connecting to ${mcpUrl}`);

  // Create upstream HTTP client with cookie
  const upstreamClient = new Client({
    name: 'gemindex-proxy-client',
    version: '1.0.0',
  });

  // Custom fetch with optional cookie header
  const customFetch: typeof fetch = (url, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) {
      headers.set('Cookie', `${COOKIE_NAME}=${cookie}`);
    }

    return fetch(url, {
      ...init,
      headers,
    });
  };

  const httpTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    fetch: customFetch,
  });

  await upstreamClient.connect(httpTransport);
  console.error('Connected to upstream MCP server');

  // Create local stdio server using low-level Server for pass-through
  const server = new Server(
    {
      name: 'gemindex-mcp-proxy',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Proxy: List Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await upstreamClient.listTools();
    console.error(`Discovered ${result.tools.length} tools from upstream`);
    return result;
  });

  // Proxy: Call Tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await upstreamClient.callTool({
        name: request.params.name,
        arguments: request.params.arguments,
      });
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  console.error('MCP proxy server started (stdio)');
}
