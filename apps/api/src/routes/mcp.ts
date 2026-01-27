import Router from '@koa/router';
import type { Next, ParameterizedContext } from 'koa';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/index.js';

const router = new Router({ prefix: '/mcp' });

// Basic Auth 미들웨어 (환경변수로 활성화)
const basicAuth = async (ctx: ParameterizedContext, next: Next) => {
  const authEnabled = process.env.MCP_AUTH_ENABLED === 'true';

  if (!authEnabled) {
    return next();
  }

  const username = process.env.MCP_AUTH_USERNAME;
  const password = process.env.MCP_AUTH_PASSWORD;

  if (!username || !password) {
    ctx.status = 500;
    ctx.body = { error: 'Auth enabled but credentials not configured' };
    return;
  }

  const authHeader = ctx.headers.authorization;
  if (!authHeader?.startsWith('Basic ')) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Basic realm="GemIndex MCP"');
    ctx.body = { error: 'Authentication required' };
    return;
  }

  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = credentials.split(':');

  if (user !== username || pass !== password) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid credentials' };
    return;
  }

  return next();
};

// POST /mcp - MCP 요청 처리 (Stateless 모드)
router.post('/', basicAuth, async (ctx) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless
    enableJsonResponse: true, // JSON 응답 모드
  });

  const server = createMcpServer();
  await server.connect(transport);

  try {
    // Koa의 ctx.req/ctx.res는 Node.js 네이티브 객체
    // handleRequest가 응답을 직접 작성하므로 Koa의 응답 처리 우회
    ctx.respond = false;
    await transport.handleRequest(ctx.req, ctx.res, ctx.request.body);
  } finally {
    await transport.close();
    await server.close();
  }
});

// GET /mcp - SSE 스트리밍용 (Stateless 모드에서는 미지원)
router.get('/', basicAuth, async (ctx) => {
  ctx.status = 405;
  ctx.body = {
    jsonrpc: '2.0',
    error: { code: -32000, message: 'SSE not supported in stateless mode' },
    id: null,
  };
});

// DELETE /mcp - 세션 종료 (Stateless 모드에서는 미지원)
router.delete('/', basicAuth, async (ctx) => {
  ctx.status = 405;
  ctx.body = {
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Session termination not supported in stateless mode' },
    id: null,
  };
});

export default router;
