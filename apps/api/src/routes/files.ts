import Router from '@koa/router';
import multer from '@koa/multer';
import fs from 'fs/promises';
import os from 'os';
import * as gemini from '../lib/gemini.js';

const router = new Router({ prefix: '/api/stores' });
const upload = multer({ dest: os.tmpdir() });

// List files in a store
router.get('/:storeName/files', async (ctx) => {
  try {
    const storeName = decodeURIComponent(ctx.params['storeName'] as string);
    const files = await gemini.listFiles(storeName);
    ctx.body = { files };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to list files' };
  }
});

// Upload a file to a store
router.post('/:storeName/files', upload.single('file'), async (ctx) => {
  const file = ctx.file;

  try {
    const storeName = decodeURIComponent(ctx.params['storeName'] as string);

    if (!file) {
      ctx.status = 400;
      ctx.body = { message: 'No file provided' };
      return;
    }

    // Parse config from form data
    let config: gemini.UploadConfig | undefined;
    const body = ctx.request.body as Record<string, unknown> | undefined;
    const configStr = body?.config;
    if (configStr && typeof configStr === 'string') {
      try {
        config = JSON.parse(configStr);
      } catch {
        // Ignore parse errors
      }
    }

    // Use original filename as display name if not provided
    if (!config?.displayName && file.originalname) {
      config = { ...config, displayName: file.originalname };
    }

    const operation = await gemini.uploadFile(storeName, file.path, config);

    ctx.status = 202;
    ctx.body = operation;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to upload file' };
  } finally {
    // Clean up temp file
    if (file?.path) {
      await fs.unlink(file.path).catch(() => {});
    }
  }
});

// Delete a file from a store
router.delete('/:storeName/files/:fileName', async (ctx) => {
  try {
    const storeName = decodeURIComponent(ctx.params['storeName'] as string);
    const fileName = decodeURIComponent(ctx.params['fileName'] as string);

    await gemini.deleteFile(storeName, fileName);
    ctx.status = 204;
  } catch (error) {
    ctx.status = 500;
    ctx.body = { message: error instanceof Error ? error.message : 'Failed to delete file' };
  }
});

export default router;
