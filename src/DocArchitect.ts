import fs from 'fs-extra';
import path from 'node:path';
import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import glob from 'fast-glob';

export interface DocConfig {
  apiKey: string;
  sourceRoot: string;
  docsRoot: string;
  mappings: Record<string, string>;
  model?: string;
  maxCodeChars?: number;
  include?: string[];
}

export class DocArchitect {
  private deepseek;
  private config: Required<DocConfig>;

  constructor(config: DocConfig) {
    this.config = {
      model: 'deepseek-chat',
      maxCodeChars: 30000,
      include: ['**/*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h,cs}'],
      ...config
    };
    this.deepseek = createDeepSeek({
      apiKey: this.config.apiKey,
    });
  }

  async sync() {
    console.log('🚀 DocArchitect: Synchronizing documentation...');

    const blocks = await this.groupFilesByBlock();

    for (const [block, files] of Object.entries(blocks)) {
      const docFile = this.config.mappings[block];
      if (!docFile) continue;

      const docPath = path.join(this.config.docsRoot, docFile);
      const currentDoc = (await fs.pathExists(docPath)) ? await fs.readFile(docPath, 'utf-8') : '';

      console.log(`📡 Analyzing block: ${block} -> ${docFile}`);

      const codeSummary = files.map(f => `--- File: ${f.relPath} ---\n${f.content}`).join('\n\n');
      const fileList = files.map(f => f.relPath).join(', ');

      const { text: newDoc } = await generateText({
        model: this.deepseek(this.config.model),
        system: `You are the "DocArchitect", an elite documentation engineer. 
        Your task is to keep technical documentation perfectly in sync with the source code.
        You write documentation for developers. It should read like an extension of the code: clear, structured, and technically dense but readable.
        Avoid boilerplate corporate summaries. Focus on the 'why' and the 'how'.`,
        prompt: `
            OBJECTIVE:
            Update the documentation for the "${block}" component.
            THE SOURCE FILES INCLUDED IN THIS ANALYSIS ARE: ${fileList}

            CRITICAL REQUIREMENTS:
            1. ACCURACY: Reflect current classes, interfaces, functions, methods, and logic.
            2. ARCHITECTURE COHERENCE: Describe how these files interact.
            3. CODE-CENTRIC: Reference specific files and paths. Use Mermaid diagrams if they clarify the flow.
            4. DYNAMIC SYNC: Add new features, remove outdated references.
            5. MINIMALISM: No fluff. Start immediately with the architecture.

            CURRENT DOCUMENTATION CONTENT:
            ${currentDoc || '[Empty - New Document]'}
            
            ACTUAL SOURCE CODE FOR THIS BLOCK:
            ${codeSummary.slice(0, this.config.maxCodeChars)}
            
            TASK:
            Return the full, UPDATED content for the markdown file "${docFile}".
            ONLY return the markdown content.
        `,
        temperature: 0.1,
      });

      if (newDoc && newDoc.trim() !== currentDoc.trim()) {
        await fs.ensureDir(path.dirname(docPath));
        await fs.writeFile(docPath, newDoc.trim());
        console.log(`✅ Updated ${docFile}`);
      } else {
        console.log(`ℹ️ ${docFile} is already in sync.`);
      }
    }

    console.log('✨ Synchronization complete.');
  }

  private async groupFilesByBlock() {
    const files = await glob(this.config.include, { cwd: this.config.sourceRoot });
    const groups: Record<string, Array<{ relPath: string; content: string }>> = {};

    for (const relPath of files) {
      const parts = relPath.split(path.sep);
      if (parts.length > 0) {
        const block = parts[0];
        if (!groups[block]) groups[block] = [];
        
        const content = await fs.readFile(path.join(this.config.sourceRoot, relPath), 'utf-8');
        groups[block].push({ relPath, content });
      }
    }
    return groups;
  }
}
