#!/usr/bin/env node
import { Command } from 'commander';
import { syncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('gemindex')
  .description('CLI for syncing files to Gemini File Search stores')
  .version('0.0.1');

program.addCommand(syncCommand);

program.parse();
