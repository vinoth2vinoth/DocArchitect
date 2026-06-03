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
  .option('--incremental', 'enable incremental generation with caching to reduce token usage')
  .option('--validate-config', 'validate configuration file and exit')
  .option('--health', 'analyze and display documentation health metrics')
  .option('--smart-budget', 'enable smart context budgeting based on file importance scoring')
  .option('--budget-strategy <strategy>', 'budget strategy: balanced, coverage, or depth', 'balanced')
  .option('--max-tokens <number>', 'maximum tokens for context window', '4096')
  .action(async (options) => {
    try {
      const configPath = path.resolve(process.cwd(), options.config);
      
      if (!await fs.pathExists(configPath)) {
        console.error(`Error: Configuration file not found at ${configPath}`);
        process.exit(1);
      }

      const userConfig = await fs.readJSON(configPath);
      
      // Health check if requested
      if (options.health) {
        const { DocumentationHealth } = await import('../src/health.js');
        const health = new DocumentationHealth(
          path.resolve(process.cwd(), userConfig.docsRoot),
          path.resolve(process.cwd(), userConfig.sourceRoot),
          path.resolve(process.cwd(), userConfig.cacheDir || './.doc-architect-cache'),
          userConfig.mappings
        );
        
        const metrics = await health.analyze();
        health.printReport(metrics);
        
        // Exit with error if critical issues found
        const criticalIssues = metrics.recommendations.filter(r => r.priority === 'high');
        if (criticalIssues.length > 0) {
          console.warn(`⚠️  ${criticalIssues.length} critical issue(s) require attention`);
          process.exit(1);
        }
        return;
      }
      
      // Validate config if requested
      if (options.validateConfig) {
        console.log('Validating configuration...');
        const requiredFields = ['sourceRoot', 'docsRoot', 'mappings'];
        const missingFields = requiredFields.filter(field => !userConfig[field]);
        
        if (missingFields.length > 0) {
          console.error(`Error: Missing required fields: ${missingFields.join(', ')}`);
          process.exit(1);
        }
        
        // Check sourceRoot exists
        if (!await fs.pathExists(userConfig.sourceRoot)) {
          console.error(`Error: sourceRoot directory not found: ${userConfig.sourceRoot}`);
          process.exit(1);
        }
        
        // Validate mappings format
        if (typeof userConfig.mappings !== 'object' || Array.isArray(userConfig.mappings)) {
          console.error('Error: mappings must be an object mapping blocks to document files');
          process.exit(1);
        }
        
        console.log('✓ Configuration is valid');
        console.log(`  Source root: ${userConfig.sourceRoot}`);
        console.log(`  Docs root: ${userConfig.docsRoot}`);
        console.log(`  Mappings: ${Object.keys(userConfig.mappings).length} block(s)`);
        console.log(`  Provider: ${userConfig.provider || 'deepseek'}`);
        return;
      }
      
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
        failOnValidationWarnings: Boolean(options.failOnValidationWarnings),
        incremental: Boolean(options.incremental),
        smartBudget: Boolean(options.smartBudget),
        budgetStrategy: options.budgetStrategy as 'balanced' | 'coverage' | 'depth' || 'balanced',
        maxTokens: parseInt(options.maxTokens, 10) || 4096
      });

      await architect.sync();
    } catch (err) {
      console.error('Fatal error during sync:', err);
      process.exit(1);
    }
  });

program.parse();
