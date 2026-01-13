import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as gemini from '../../lib/gemini.js';

export function registerFileTools(server: McpServer): void {
  // list_files - Store 내 파일 목록 조회
  server.registerTool(
    'list_files',
    {
      title: 'List Files',
      description: 'List all files in a specific store',
      inputSchema: {
        storeName: z
          .string()
          .describe(
            'Store identifier. Use the "name" field from list_stores (e.g., "fileSearchStores/timtest-06m38rk98z12") or just the ID part (e.g., "timtest-06m38rk98z12")'
          ),
      },
    },
    async ({ storeName }) => {
      try {
        const files = await gemini.listFiles(storeName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(files, null, 2),
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
