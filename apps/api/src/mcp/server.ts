import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerStoreTools,
  registerFileTools,
  registerSearchTool,
  registerOperationTool,
} from './tools/index.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'gemindex-mcp',
    version: '1.0.0',
  });

  // Read-only Tools만 등록
  registerStoreTools(server); // list_stores, get_store
  registerFileTools(server); // list_files
  registerSearchTool(server); // search
  registerOperationTool(server); // get_operation

  return server;
}
