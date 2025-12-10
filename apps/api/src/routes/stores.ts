import Router from '@koa/router';
import * as gemini from '../lib/gemini.js';

const router = new Router({ prefix: '/api/stores' });

// List all stores
router.get('/', async (ctx) => {
  try {
    const stores = await gemini.listStores();
    ctx.body = { stores };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to list stores' };
  }
});

// Create a new store
router.post('/', async (ctx) => {
  try {
    const { displayName } = ctx.request.body as { displayName?: string };

    if (!displayName) {
      ctx.status = 400;
      ctx.body = { message: 'displayName is required' };
      return;
    }

    const store = await gemini.createStore(displayName);
    ctx.status = 201;
    ctx.body = store;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to create store' };
  }
});

// Get a specific store
router.get('/:name', async (ctx) => {
  try {
    const name = decodeURIComponent(ctx.params['name'] as string);
    const store = await gemini.getStore(name);
    ctx.body = store;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to get store' };
  }
});

// Delete a store
router.delete('/:name', async (ctx) => {
  try {
    const name = decodeURIComponent(ctx.params['name'] as string);
    const force = ctx.query.force === 'true';

    await gemini.deleteStore(name, force);
    ctx.status = 204;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to delete store' };
  }
});

export default router;
