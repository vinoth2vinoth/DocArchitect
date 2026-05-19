import fs from 'fs-extra';
import path from 'node:path';
import { generateText, LanguageModel } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import glob from 'fast-glob';

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'google';

export interface DocConfig {
  apiKey?: string;
  provider?: LLMProvider;
  sourceRoot: string;
  docsRoot: string;
  mappings: Record<string, string>;
  model?: string;
  maxCodeChars?: number;
  include?: string[];
  dryRun?: boolean;
  check?: boolean;
  validateLinks?: boolean;
  failOnValidationWarnings?: boolean;
}

export interface SourceFileBlock {
  relPath: string;
  content: string;
}

export interface TargetDocument {
  docFile: string;
  blocks: string[];
  files: SourceFileBlock[];
}

export interface SyncResult {
  docFile: string;
  changed: boolean;
  warnings: string[];
  preview?: string;
}

export class DocArchitect {
  private modelInstance: LanguageModel;
  private config: Required<DocConfig>;

  constructor(config: DocConfig) {
    this.config = {
      provider: 'deepseek',
      apiKey: '',
      model: '',
      maxCodeChars: 30000,
      include: ['**/*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h,cs}'],
      dryRun: false,
      check: false,
      validateLinks: true,
      failOnValidationWarnings: false,
      ...config
    };

    this.modelInstance = this.initializeProvider();
  }

  private initializeProvider(): LanguageModel {
    const { provider, apiKey, model } = this.config;

    switch (provider) {
      case 'openai': {
        const openai = createOpenAI({ apiKey });
        return openai(model || 'gpt-4o');
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey });
        return anthropic(model || 'claude-3-5-sonnet-20240620');
      }
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(model || 'gemini-1.5-pro');
      }
      case 'deepseek':
      default: {
        const deepseek = createDeepSeek({ apiKey });
        return deepseek(model || 'deepseek-chat');
      }
    }
  }

  async sync(): Promise<SyncResult[]> {
    console.log(`DocArchitect: Synchronizing documentation using ${this.config.provider}...`);

    const blocks = await this.groupFilesByBlock();
    const targets = groupBlocksByDocument(blocks, this.config.mappings);
    const results: SyncResult[] = [];

    for (const target of targets) {
      const { docFile, blocks: blockNames, files } = target;
      const docPath = path.join(this.config.docsRoot, docFile);
      const currentDoc = (await fs.pathExists(docPath)) ? await fs.readFile(docPath, 'utf-8') : '';

      console.log(`Analyzing ${blockNames.join(', ')} -> ${docFile}`);
      const startTime = Date.now();

      const codeSummary = buildCodeContext(files, this.config.maxCodeChars);
      const fileList = files.map(f => f.relPath).join(', ');

      const { text: newDoc, usage } = await generateText({
        model: this.modelInstance,
        system: `You are DocArchitect, an elite documentation engineer.
        Your task is to keep technical documentation in sync with the source code.
        You write documentation for developers. It should read like an extension of the code: clear, structured, technically dense, and readable.

        CRITICAL RULE: Focus on the architecture. Do not just summarize files. Explain how these files interact to form the "${blockNames.join(', ')}" logic.
        Link functions across files and explain the data flow. Use Mermaid diagrams if they help visualize relationships.`,
        prompt: `
            OBJECTIVE:
            Update the documentation for these related source blocks: ${blockNames.join(', ')}.
            THE SOURCE FILES INCLUDED IN THIS ANALYSIS ARE: ${fileList}

            CRITICAL REQUIREMENTS:
            1. ACCURACY: Reflect current classes, interfaces, functions, methods, and logic.
            2. ARCHITECTURE COHERENCE: Describe how these files interact. Do not treat them as isolated units.
            3. CODE-CENTRIC: Reference specific files and paths.
            4. DYNAMIC SYNC: Add new features, remove outdated references.
            5. MINIMALISM: No fluff. Start immediately with the architecture.

            CURRENT DOCUMENTATION CONTENT:
            ${currentDoc || '[Empty - New Document]'}

            ACTUAL SOURCE CODE FOR THIS DOCUMENT:
            ${codeSummary}

            TASK:
            Return the full, UPDATED content for the markdown file "${docFile}".
            ONLY return the markdown content.
        `,
        temperature: 0.1,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      if (usage) {
        console.log(`  Stats: ${usage.totalTokens} tokens | ${duration}s | ${this.config.model || 'default-model'}`);
      }

      const warnings = this.config.validateLinks
        ? await validateMarkdownReferences(newDoc || '', this.config.docsRoot, this.config.sourceRoot)
        : [];

      for (const warning of warnings) {
        console.warn(`  Warning: ${warning}`);
      }

      if (this.config.failOnValidationWarnings && warnings.length > 0) {
        throw new Error(`Validation failed for ${docFile}: ${warnings.join('; ')}`);
      }

      if (newDoc && newDoc.trim() !== currentDoc.trim()) {
        const preview = createChangePreview(currentDoc, newDoc);
        results.push({ docFile, changed: true, warnings, preview });

        if (this.config.dryRun || this.config.check) {
          console.log(`  Pending update for ${docFile}`);
          console.log(preview);
          continue;
        }

        await fs.ensureDir(path.dirname(docPath));
        await fs.writeFile(docPath, newDoc.trim());
        console.log(`Updated ${docFile}`);
      } else {
        results.push({ docFile, changed: false, warnings });
        console.log(`${docFile} is already in sync.`);
      }
    }

    if (this.config.check && results.some(result => result.changed)) {
      throw new Error('Documentation is out of sync. Run doc-architect without --check to update files.');
    }

    console.log('Synchronization complete.');
    return results;
  }

  private async groupFilesByBlock(): Promise<Record<string, SourceFileBlock[]>> {
    const files = await glob(this.config.include, { cwd: this.config.sourceRoot });
    const groups: Record<string, SourceFileBlock[]> = {};

    for (const relPath of files.sort((a, b) => a.localeCompare(b))) {
      const normalizedRelPath = relPath.replace(/\\/g, '/');
      const parts = normalizedRelPath.split('/');
      const block = parts[0];
      if (!block) continue;

      const content = await fs.readFile(path.join(this.config.sourceRoot, normalizedRelPath), 'utf-8');
      if (!groups[block]) groups[block] = [];
      groups[block].push({ relPath: parts.slice(1).join('/'), content });
    }

    return groups;
  }
}

export function groupBlocksByDocument(
  blocks: Record<string, SourceFileBlock[]>,
  mappings: Record<string, string>
): TargetDocument[] {
  const grouped = new Map<string, TargetDocument>();

  for (const [block, files] of Object.entries(blocks)) {
    const docFile = mappings[block];
    if (!docFile) continue;

    const existing = grouped.get(docFile) || { docFile, blocks: [], files: [] };
    existing.blocks.push(block);
    existing.files.push(...files.map(file => ({
      relPath: path.join(block, file.relPath).replace(/\\/g, '/'),
      content: file.content
    })));
    grouped.set(docFile, existing);
  }

  return Array.from(grouped.values()).map(target => ({
    ...target,
    blocks: target.blocks.sort((a, b) => a.localeCompare(b)),
    files: target.files.sort((a, b) => a.relPath.localeCompare(b.relPath))
  }));
}

export function buildCodeContext(files: SourceFileBlock[], maxChars: number): string {
  let remaining = Math.max(0, maxChars);
  const sections: string[] = [];
  const sortedFiles = [...files].sort((a, b) => a.relPath.localeCompare(b.relPath));

  for (const file of sortedFiles) {
    const header = `--- File: ${file.relPath} ---\n`;
    if (remaining <= header.length) {
      sections.push(`--- File: ${file.relPath} ---\n[Omitted: context budget exhausted before this file.]`);
      continue;
    }

    const budgetForContent = remaining - header.length;
    const included = file.content.slice(0, budgetForContent);
    const truncatedNote = included.length < file.content.length
      ? `\n[Truncated: ${file.content.length - included.length} characters omitted from this file.]`
      : '';

    sections.push(`${header}${included}${truncatedNote}`);
    remaining -= header.length + included.length + truncatedNote.length;
  }

  return sections.join('\n\n');
}

export async function validateMarkdownReferences(markdown: string, docsRoot: string, sourceRoot: string): Promise<string[]> {
  const warnings: string[] = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const roots = [docsRoot, sourceRoot].map(root => path.resolve(root));
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(markdown)) !== null) {
    const rawTarget = match[1].trim();
    const target = rawTarget.split('#')[0].trim();
    if (!target || /^(https?:|mailto:|#)/i.test(target)) continue;
    if (target.startsWith('data:')) continue;

    const decoded = decodeURIComponent(target);
    const exists = roots
      .map(root => path.resolve(root, decoded))
      .some(candidate => fs.existsSync(candidate));

    if (!exists) {
      warnings.push(`Broken local markdown link: ${rawTarget}`);
    }
  }

  return warnings;
}

export function createChangePreview(before: string, after: string, maxLines: number = 80): string {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const preview: string[] = [
    `--- current (${beforeLines.length} lines)`,
    `+++ proposed (${afterLines.length} lines)`
  ];

  const limit = Math.min(Math.max(beforeLines.length, afterLines.length), maxLines);
  for (let i = 0; i < limit; i++) {
    const oldLine = beforeLines[i];
    const newLine = afterLines[i];
    if (oldLine === newLine) continue;
    if (oldLine !== undefined) preview.push(`- ${oldLine}`);
    if (newLine !== undefined) preview.push(`+ ${newLine}`);
  }

  const totalChanged = Math.abs(afterLines.length - beforeLines.length)
    + afterLines.filter((line, index) => line !== beforeLines[index]).length;
  if (preview.length === 2) preview.push('(content changed only by trailing whitespace)');
  if (totalChanged > maxLines) preview.push(`... ${totalChanged - maxLines} additional changed lines not shown`);

  return preview.join('\n');
}
