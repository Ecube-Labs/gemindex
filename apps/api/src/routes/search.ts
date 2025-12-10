import Router from '@koa/router';
import * as gemini from '../lib/gemini.js';

const router = new Router({ prefix: '/api' });

// Search documents
router.post('/search', async (ctx) => {
  try {
    const { storeName, query, systemPrompt, model, temperature, topP, topK, maxOutputTokens } = ctx
      .request.body as {
      storeName?: string;
      query?: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      topP?: number;
      topK?: number;
      maxOutputTokens?: number;
    };

    if (!storeName) {
      ctx.status = 400;
      ctx.body = { message: 'storeName is required' };
      return;
    }

    if (!query) {
      ctx.status = 400;
      ctx.body = { message: 'query is required' };
      return;
    }

    const result = await gemini.search(storeName, query, {
      systemPrompt,
      model,
      temperature,
      topP,
      topK,
      maxOutputTokens,
    });
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to search' };
  }
});

export default router;
