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
  .option('--dry-run', 'generate documentation and print a change preview without writing files')
  .option('--check', 'fail if generated documentation would change any files')
  .option('--no-validate-links', 'skip validation of local markdown links in generated docs')
  .option('--fail-on-validation-warnings', 'fail when generated docs contain validation warnings')
  .action(async (options) => {
    try {
      const configPath = path.resolve(process.cwd(), options.config);
      
      if (!await fs.pathExists(configPath)) {
        console.error(`Error: Configuration file not found at ${configPath}`);
        process.exit(1);
      }

      const userConfig = await fs.readJSON(configPath);
      
      let apiKey = userConfig.apiKey;
      let provider = userConfig.provider || 'deepseek';

      // Auto-detection logic for API keys if not in config
      if (!apiKey) {
        if (process.env.DEEPSEEK_API_KEY) {
          apiKey = process.env.DEEPSEEK_API_KEY;
          provider = 'deepseek';
        } else if (process.env.OPENAI_API_KEY) {
          apiKey = process.env.OPENAI_API_KEY;
          provider = 'openai';
        } else if (process.env.ANTHROPIC_API_KEY) {
          apiKey = process.env.ANTHROPIC_API_KEY;
          provider = 'anthropic';
        } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
          apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
          provider = 'google';
        }
      }

      if (!apiKey) {
        console.error('Error: No API key found. Please set DEEPSEEK_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.');
        process.exit(1);
      }

      const architect = new DocArchitect({
        apiKey,
        provider,
        ...userConfig,
        dryRun: Boolean(options.dryRun),
        check: Boolean(options.check),
        validateLinks: Boolean(options.validateLinks),
        failOnValidationWarnings: Boolean(options.failOnValidationWarnings)
      });

      await architect.sync();
    } catch (err) {
      console.error('Fatal error during sync:', err);
      process.exit(1);
    }
  });

program.parse();
