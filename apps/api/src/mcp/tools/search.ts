import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as gemini from '../../lib/gemini.js';

export function registerSearchTool(server: McpServer): void {
  // search - 시맨틱 검색
  server.registerTool(
    'search',
    {
      title: 'Semantic Search',
      description:
        'Search documents in a store using natural language query powered by Gemini. Returns the answer along with source citations.',
      inputSchema: {
        storeName: z
          .string()
          .describe(
            'Store identifier to search in. Use the "name" field from list_stores (e.g., "fileSearchStores/timtest-06m38rk98z12") or just the ID part (e.g., "timtest-06m38rk98z12")'
          ),
        query: z.string().describe('Natural language search query'),
        systemPrompt: z
          .string()
          .optional()
          .describe('Optional system prompt to guide the search response'),
        model: z.string().optional().describe('Gemini model to use (default: gemini-2.5-flash)'),
        temperature: z
          .number()
          .min(0)
          .max(2)
          .optional()
          .describe('Response randomness (0-2, default: model default)'),
        maxOutputTokens: z.number().optional().describe('Maximum tokens in response'),
      },
    },
    async ({ storeName, query, systemPrompt, model, temperature, maxOutputTokens }) => {
      try {
        const result = await gemini.search(storeName, query, {
          systemPrompt,
          model,
          temperature,
          maxOutputTokens,
        });

        // 구조화된 응답
        const response = {
          answer: result.text,
          sources: result.sources.map((s) => ({
            title: s.title,
            excerpt: s.text.slice(0, 500) + (s.text.length > 500 ? '...' : ''),
          })),
          citations: result.supports.map((s) => ({
            text: s.text,
            sourceIndices: s.chunkIndices,
          })),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
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
