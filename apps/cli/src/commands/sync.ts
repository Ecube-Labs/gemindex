import { Command } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import path from 'path';
import { loadConfig, ConfigError } from '../lib/config.js';
import { scanFiles } from '../lib/file-scanner.js';
import { computeHashes } from '../lib/hasher.js';
import { ApiClient } from '../lib/api-client.js';
import { buildSyncPlan } from '../lib/sync-engine.js';
import { executeUploads, executeDeletes } from '../lib/uploader.js';
import {
  formatSyncPlan,
  formatSyncSummary,
  buildSummary,
  formatFailures,
} from '../lib/reporter.js';
import { confirmSync, printCancelled, printDryRun } from '../lib/prompt.js';
import { graceful, AbortError } from '../lib/graceful.js';
import type { UploadResult, DeleteResult } from '../lib/uploader.js';

export const syncCommand = new Command('sync')
  .description('Sync local files to a Gemini File Search store')
  .option('-c, --config <path>', 'Config file path', '.gemindex.yml')
  .option('-y, --yes', 'Skip confirmation prompt (auto-approve)')
  .option('-n, --dry-run', 'Show plan without executing')
  .option('-d, --delete', 'Delete remote files not in local')
  .option('--concurrency <n>', 'Parallel upload limit', '8')
  .option('-s, --store <name>', 'Target store name (overrides config)')
  .option('-e, --endpoint <url>', 'API endpoint URL (overrides config)')
  .action(async (options) => {
    const startTime = Date.now();
    let spinner: ReturnType<typeof ora> | null = null;

    // Register cleanup on shutdown
    graceful.onShutdown(() => {
      if (spinner) {
        spinner.fail('Cancelled by user');
      }
    });

    try {
      // 1. Load config
      spinner = ora('Loading config...').start();
      const configPath = path.resolve(options.config);
      const config = loadConfig(configPath);
      const storeName = options.store || config.store;
      const deleteRemote = options.delete ?? config.sync?.delete ?? false;
      const concurrency = parseInt(options.concurrency) || config.sync?.concurrency || 8;
      spinner.succeed(`Config loaded (store: ${pc.cyan(storeName)})`);

      graceful.checkAborted();

      // 2. Initialize API client
      const token = config.api?.token_env ? process.env[config.api.token_env] : undefined;
      const endpoint = options.endpoint || config.api?.endpoint || 'http://localhost:4000';
      const client = new ApiClient({
        endpoint,
        token,
      });

      // 3. Scan local files
      spinner = ora('Scanning local files...').start();
      const baseDir = path.dirname(configPath);
      const localFiles = await scanFiles(baseDir, config.collect.include, config.collect.exclude);
      spinner.succeed(`Found ${pc.cyan(String(localFiles.length))} local file(s)`);

      graceful.checkAborted();

      // 4. Compute hashes
      spinner = ora('Computing file hashes...').start();
      const localHashes = await computeHashes(localFiles, graceful.signal);
      spinner.succeed('Hashes computed');

      graceful.checkAborted();

      // 5. Fetch remote files
      spinner = ora('Fetching remote files...').start();
      const remoteFiles = await client.listFiles(storeName, graceful.signal);
      spinner.succeed(`Found ${pc.cyan(String(remoteFiles.length))} remote file(s)`);

      graceful.checkAborted();

      // 6. Build sync plan
      const plan = buildSyncPlan(localFiles, localHashes, remoteFiles, deleteRemote);
      console.log();
      console.log(formatSyncPlan(plan));

      // 7. Check if nothing to do
      if (plan.uploads.length === 0 && plan.deletes.length === 0) {
        console.log(pc.green('\nEverything is up to date!'));
        process.exit(0);
      }

      // 8. Handle dry-run
      if (options.dryRun) {
        printDryRun();
        process.exit(0);
      }

      // 9. Confirm (unless --yes)
      if (!options.yes) {
        const confirmed = await confirmSync();
        if (!confirmed) {
          printCancelled(false);
          process.exit(0);
        }
      }

      graceful.checkAborted();

      // 10. Execute uploads
      let uploadResults: UploadResult[] = [];
      if (plan.uploads.length > 0) {
        console.log();
        const total = plan.uploads.length;
        spinner = ora(`Uploading (0/${total})`).start();

        uploadResults = await executeUploads(
          client,
          storeName,
          plan.uploads,
          { concurrency },
          graceful.signal,
          (progress) => {
            const status = progress.result
              ? progress.result.success
                ? pc.green('✓')
                : pc.red('✗')
              : pc.cyan('↑');
            spinner!.text = `Uploading (${progress.completed}/${total}) ${status} ${pc.dim(progress.currentFile)}`;
          }
        );

        const failed = uploadResults.filter((r) => !r.success && !r.cancelled).length;
        const cancelled = uploadResults.filter((r) => r.cancelled).length;
        const succeeded = uploadResults.filter((r) => r.success).length;

        if (cancelled > 0) {
          spinner.warn(`Cancelled (${succeeded} uploaded, ${cancelled} remaining)`);
        } else if (failed > 0) {
          spinner.warn(`Uploaded ${succeeded} file(s) with ${failed} error(s)`);
        } else {
          spinner.succeed(`Uploaded ${succeeded} file(s)`);
        }
      }

      graceful.checkAborted();

      // 11. Execute deletes
      let deleteResults: DeleteResult[] = [];
      if (plan.deletes.length > 0) {
        spinner = ora(`Deleting ${plan.deletes.length} file(s)...`).start();
        deleteResults = await executeDeletes(
          client,
          storeName,
          plan.deletes,
          concurrency,
          graceful.signal
        );
        spinner.succeed(`Deleted ${plan.deletes.length} file(s)`);
      }

      // 12. Print summary
      const summary = buildSummary(uploadResults, deleteResults, plan.skips.length, startTime);
      console.log(formatSyncSummary(summary));

      const failures = formatFailures(uploadResults, deleteResults);
      if (failures) {
        console.log(failures);
      }

      // 13. Exit with appropriate code
      const hasErrors =
        uploadResults.some((r) => !r.success && !r.cancelled) ||
        deleteResults.some((r) => !r.success);
      process.exit(hasErrors ? 1 : 0);
    } catch (error) {
      if (spinner) {
        spinner.stop();
      }

      if (error instanceof AbortError) {
        console.log(pc.yellow('\nCancelled by user.'));
        process.exit(130);
      }

      if (error instanceof ConfigError) {
        console.error(pc.red(`\nConfig error: ${error.message}`));
        process.exit(2);
      }

      console.error(pc.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
