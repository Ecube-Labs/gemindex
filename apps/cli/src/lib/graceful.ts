import { EventEmitter } from 'events';

export class AbortError extends Error {
  constructor(message = 'Operation cancelled by user') {
    super(message);
    this.name = 'AbortError';
  }
}

class GracefulShutdown extends EventEmitter {
  private abortController: AbortController;
  private isShuttingDown = false;

  constructor() {
    super();
    this.abortController = new AbortController();
    this.setupSignalHandlers();
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  private setupSignalHandlers() {
    const handler = () => {
      if (this.isShuttingDown) {
        // Second Ctrl+C: force exit
        process.exit(1);
      }
      this.isShuttingDown = true;
      this.abortController.abort();
      this.emit('shutdown');
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }

  /**
   * Check if operation was aborted and throw if so.
   * Call this at key points in the execution flow.
   */
  checkAborted(): void {
    if (this.isAborted) {
      throw new AbortError();
    }
  }

  /**
   * Register a cleanup function to run on shutdown.
   */
  onShutdown(fn: () => void | Promise<void>): void {
    this.on('shutdown', fn);
  }

  /**
   * Remove a cleanup function.
   */
  offShutdown(fn: () => void | Promise<void>): void {
    this.off('shutdown', fn);
  }
}

// Singleton instance
export const graceful = new GracefulShutdown();
