import Router from '@koa/router';
import * as gemini from '../lib/gemini.js';

const router = new Router({ prefix: '/api/stores' });

// Get list of protected store IDs from environment variable
function getProtectedStoreIds(): string[] {
  const protectedStores = process.env.PROTECTED_STORES;
  if (!protectedStores) return [];
  return protectedStores
    .split(',')
    .map((s) => s.trim())
    .map((s) => s.replace(/^fileSearchStores\//, '')) // Normalize to ID only
    .filter(Boolean);
}

// Check if a store name is protected
function isProtectedStore(name: string): boolean {
  const protectedIds = getProtectedStoreIds();
  const storeId = name.replace(/^fileSearchStores\//, '');
  return protectedIds.includes(storeId);
}

// List all stores
router.get('/', async (ctx) => {
  try {
    const stores = await gemini.listStores();
    const storesWithProtection = stores.map((store) => ({
      ...store,
      protected: store.name ? isProtectedStore(store.name) : false,
    }));
    ctx.body = { stores: storesWithProtection };
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

    // Check if store is protected
    if (isProtectedStore(name)) {
      ctx.status = 403;
      ctx.body = { message: 'This store is protected and cannot be deleted' };
      return;
    }

    const force = ctx.query.force === 'true';

    await gemini.deleteStore(name, force);
    ctx.status = 204;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to delete store' };
  }
});

export default router;
