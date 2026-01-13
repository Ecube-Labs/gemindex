import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as gemini from '../../lib/gemini.js';

export function registerOperationTool(server: McpServer): void {
  // get_operation - 비동기 작업 상태 조회
  server.registerTool(
    'get_operation',
    {
      title: 'Get Operation Status',
      description: 'Check the status of an async operation (e.g., file upload/import)',
      inputSchema: {
        operationName: z.string().describe('Operation name/ID to check'),
      },
    },
    async ({ operationName }) => {
      try {
        const operation = await gemini.getOperation(operationName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(operation, null, 2),
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
