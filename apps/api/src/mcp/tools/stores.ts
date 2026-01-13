import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as gemini from '../../lib/gemini.js';

export function registerStoreTools(server: McpServer): void {
  // list_stores - 모든 Store 목록 조회
  server.registerTool(
    'list_stores',
    {
      title: 'List Stores',
      description: 'List all file search stores available in GemIndex',
      inputSchema: {},
    },
    async () => {
      try {
        const stores = await gemini.listStores();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stores, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_store - Store 상세 조회
  server.registerTool(
    'get_store',
    {
      title: 'Get Store',
      description: 'Get details of a specific file search store',
      inputSchema: {
        name: z
          .string()
          .describe(
            'Store identifier. Use the "name" field from list_stores (e.g., "fileSearchStores/timtest-06m38rk98z12") or just the ID part (e.g., "timtest-06m38rk98z12")'
          ),
      },
    },
    async ({ name }) => {
      try {
        const store = await gemini.getStore(name);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(store, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
