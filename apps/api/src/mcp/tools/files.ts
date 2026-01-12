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
        storeName: z.string().describe('Store name or ID'),
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
