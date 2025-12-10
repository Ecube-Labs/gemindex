import Router from '@koa/router';
import * as gemini from '../lib/gemini.js';

const router = new Router({ prefix: '/api/operations' });

// Get operation status
router.get('/:operationName', async (ctx) => {
  try {
    const operationName = decodeURIComponent(ctx.params['operationName'] as string);
    const operation = await gemini.getOperation(operationName);
    ctx.body = operation;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to get operation' };
  }
});

export default router;
