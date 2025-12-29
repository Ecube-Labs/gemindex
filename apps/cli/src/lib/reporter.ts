import pc from 'picocolors';
import type { SyncPlan, UploadResult, DeleteResult } from '../types/index.js';

export interface SyncSummary {
  uploaded: { success: number; failed: number };
  deleted: { success: number; failed: number };
  skipped: number;
  cancelled: number;
  duration: number;
}

/**
 * Format a sync plan for display.
 */
export function formatSyncPlan(plan: SyncPlan): string {
  const lines: string[] = [];

  lines.push(pc.bold('Sync Plan:'));

  // Uploads
  if (plan.uploads.length > 0) {
    lines.push(`  ${pc.green(`${plan.uploads.length} file(s) to upload:`)}`);
    for (const action of plan.uploads) {
      const file = action.localFile?.relativePath || 'unknown';
      lines.push(`    ${pc.green('+')} ${file} (${action.reason})`);
    }
  }

  // Deletes
  if (plan.deletes.length > 0) {
    lines.push(`  ${pc.red(`${plan.deletes.length} file(s) to delete:`)}`);
    for (const action of plan.deletes) {
      const file = action.remoteFile?.originalFileName || 'unknown';
      lines.push(`    ${pc.red('-')} ${file} (${action.reason})`);
    }
  }

  // Skips
  if (plan.skips.length > 0) {
    lines.push(`  ${pc.dim(`${plan.skips.length} file(s) unchanged (skipped)`)}`);
  }

  // No changes
  if (plan.uploads.length === 0 && plan.deletes.length === 0) {
    lines.push(`  ${pc.dim('No changes detected.')}`);
  }

  return lines.join('\n');
}

/**
 * Format a sync summary for display.
 */
export function formatSyncSummary(summary: SyncSummary): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold('Summary:'));

  // Uploads
  if (summary.uploaded.success > 0 || summary.uploaded.failed > 0) {
    const uploadLine = `  Uploaded: ${pc.green(`${summary.uploaded.success} success`)}`;
    if (summary.uploaded.failed > 0) {
      lines.push(`${uploadLine}, ${pc.red(`${summary.uploaded.failed} failed`)}`);
    } else {
      lines.push(uploadLine);
    }
  }

  // Deletes
  if (summary.deleted.success > 0 || summary.deleted.failed > 0) {
    const deleteLine = `  Deleted: ${pc.green(`${summary.deleted.success} success`)}`;
    if (summary.deleted.failed > 0) {
      lines.push(`${deleteLine}, ${pc.red(`${summary.deleted.failed} failed`)}`);
    } else {
      lines.push(deleteLine);
    }
  }

  // Skipped
  if (summary.skipped > 0) {
    lines.push(`  Skipped: ${pc.dim(`${summary.skipped}`)}`);
  }

  // Cancelled
  if (summary.cancelled > 0) {
    lines.push(`  Cancelled: ${pc.yellow(`${summary.cancelled} remaining`)}`);
  }

  // Duration
  lines.push(`  Duration: ${pc.dim(`${(summary.duration / 1000).toFixed(1)}s`)}`);

  return lines.join('\n');
}

/**
 * Build summary from results.
 */
export function buildSummary(
  uploadResults: UploadResult[],
  deleteResults: DeleteResult[],
  skipped: number,
  startTime: number
): SyncSummary {
  const uploadSuccess = uploadResults.filter((r) => r.success).length;
  const uploadFailed = uploadResults.filter((r) => !r.success && !r.cancelled).length;
  const uploadCancelled = uploadResults.filter((r) => r.cancelled).length;

  const deleteSuccess = deleteResults.filter((r) => r.success).length;
  const deleteFailed = deleteResults.filter((r) => !r.success).length;

  return {
    uploaded: { success: uploadSuccess, failed: uploadFailed },
    deleted: { success: deleteSuccess, failed: deleteFailed },
    skipped,
    cancelled: uploadCancelled,
    duration: Date.now() - startTime,
  };
}

/**
 * Format failed actions for display.
 */
export function formatFailures(
  uploadResults: UploadResult[],
  deleteResults: DeleteResult[]
): string {
  const lines: string[] = [];
  const failures = [
    ...uploadResults.filter((r) => !r.success && !r.cancelled),
    ...deleteResults.filter((r) => !r.success),
  ];

  if (failures.length === 0) {
    return '';
  }

  lines.push('');
  lines.push(pc.bold(pc.red('Failures:')));

  for (const result of failures) {
    const file =
      'localFile' in result.action
        ? result.action.localFile?.relativePath
        : result.action.remoteFile?.originalFileName;
    lines.push(`  ${pc.red('✗')} ${file}: ${result.error}`);
  }

  return lines.join('\n');
}
