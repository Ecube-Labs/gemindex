import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenvx from '@dotenvx/dotenvx';

// Load all .env and .env.* files except .env.example
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = process.env.DOTENV_PATH || path.resolve(__dirname, '..');
const envFiles = fs
  .readdirSync(envDir)
  .filter((file) => /^\.env(\..+)?$/.test(file) && !file.endsWith('.example'))
  .map((file) => path.join(envDir, file));

if (envFiles.length > 0) {
  dotenvx.config({ path: envFiles });
}

import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';

import storesRouter from './routes/stores.js';
import filesRouter from './routes/files.js';
import searchRouter from './routes/search.js';
import operationsRouter from './routes/operations.js';

const app = new Koa();
const router = new Router();

// Health check
router.get('/api/health', (ctx) => {
  ctx.body = { status: 'ok', timestamp: new Date().toISOString() };
});

// Ping (lightweight health check)
router.get('/ping', (ctx) => {
  ctx.body = 'pong';
});

// Request logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} ${ctx.status} - ${ms}ms`);
});

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const error = err as Error;
    console.error('Error:', error.message);
    ctx.status = 500;
    ctx.body = { message: error.message || 'Internal server error' };
  }
});

// Middleware
app.use(cors());
app.use(bodyParser());

// Routes
app.use(router.routes());
app.use(router.allowedMethods());
app.use(storesRouter.routes());
app.use(storesRouter.allowedMethods());
app.use(filesRouter.routes());
app.use(filesRouter.allowedMethods());
app.use(searchRouter.routes());
app.use(searchRouter.allowedMethods());
app.use(operationsRouter.routes());
app.use(operationsRouter.allowedMethods());

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
