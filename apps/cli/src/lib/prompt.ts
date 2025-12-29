import readline from 'readline';
import pc from 'picocolors';
import { graceful } from './graceful.js';

/**
 * Terraform-style confirmation prompt.
 * Only accepts "yes" to proceed.
 */
export async function confirmSync(): Promise<boolean> {
  console.log('');
  console.log(pc.bold('Do you want to perform these actions?'));
  console.log('  gemindex will perform the actions described above.');
  console.log(`  Only ${pc.green("'yes'")} will be accepted to approve.`);
  console.log('');

  const answer = await prompt('  Enter a value: ');

  if (answer === null) {
    // Cancelled via Ctrl+C
    return false;
  }

  return answer.trim().toLowerCase() === 'yes';
}

/**
 * Prompt for user input with AbortSignal support.
 */
async function prompt(question: string): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle abort
    const abortHandler = () => {
      rl.close();
      resolve(null);
    };

    graceful.signal.addEventListener('abort', abortHandler, { once: true });

    rl.question(question, (answer) => {
      graceful.signal.removeEventListener('abort', abortHandler);
      rl.close();
      resolve(answer);
    });

    // Handle close without answer (e.g., Ctrl+D)
    rl.on('close', () => {
      graceful.signal.removeEventListener('abort', abortHandler);
    });
  });
}

/**
 * Print cancellation message.
 */
export function printCancelled(duringExecution: boolean = false): void {
  console.log('');
  if (duringExecution) {
    console.log(pc.yellow('Cancelled by user.'));
  } else {
    console.log(pc.dim('Cancelled. No changes were made.'));
  }
}

/**
 * Print dry-run message.
 */
export function printDryRun(): void {
  console.log('');
  console.log(pc.dim('Dry run - no changes made.'));
}
