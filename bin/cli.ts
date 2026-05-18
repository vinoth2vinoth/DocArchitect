#!/usr/bin/env node
import { Command } from 'commander';
import { DocArchitect } from '../src/DocArchitect.js';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'node:path';

dotenv.config();

const program = new Command();

program
  .name('doc-architect')
  .description('AI-powered documentation sync CLI')
  .version('1.0.0')
  .option('-c, --config <path>', 'path to config file', './doc-architect.json')
  .action(async (options) => {
    try {
      const configPath = path.resolve(process.cwd(), options.config);
      
      if (!await fs.pathExists(configPath)) {
        console.error(`Error: Configuration file not found at ${configPath}`);
        process.exit(1);
      }

      const userConfig = await fs.readJSON(configPath);
      const apiKey = process.env.DEEPSEEK_API_KEY;

      if (!apiKey) {
        console.error('Error: DEEPSEEK_API_KEY environment variable is required.');
        process.exit(1);
      }

      const architect = new DocArchitect({
        apiKey,
        ...userConfig
      });

      await architect.sync();
    } catch (err) {
      console.error('Fatal error during sync:', err);
      process.exit(1);
    }
  });

program.parse();
