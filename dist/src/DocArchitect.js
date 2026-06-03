import fs from 'fs-extra';
import path from 'node:path';
import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import glob from 'fast-glob';
import crypto from 'node:crypto';
import * as ts from 'typescript';
export class DocArchitect {
    modelInstance;
    config;
    cache = new Map();
    fileImportanceHistory = new Map();
    constructor(config) {
        this.config = {
            provider: 'deepseek',
            apiKey: '',
            model: '',
            maxCodeChars: 30000,
            maxTokens: 4096,
            include: ['**/*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h,cs}'],
            dryRun: false,
            check: false,
            validateLinks: true,
            failOnValidationWarnings: false,
            incremental: false,
            cacheDir: './.doc-architect-cache',
            smartBudget: false,
            budgetStrategy: 'balanced',
            ...config
        };
        this.modelInstance = this.initializeProvider();
        if (this.config.incremental) {
            this.loadCache();
        }
        if (this.config.smartBudget) {
            this.loadImportanceHistory();
        }
    }
    initializeProvider() {
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
    async sync() {
        console.log(`DocArchitect: Synchronizing documentation using ${this.config.provider}...`);
        const blocks = await this.groupFilesByBlock();
        const targets = groupBlocksByDocument(blocks, this.config.mappings);
        const results = [];
        for (const target of targets) {
            const { docFile, blocks: blockNames, files } = target;
            const docPath = path.join(this.config.docsRoot, docFile);
            const currentDoc = (await fs.pathExists(docPath)) ? await fs.readFile(docPath, 'utf-8') : '';
            console.log(`Analyzing ${blockNames.join(', ')} -> ${docFile}`);
            const startTime = Date.now();
            let newDoc;
            let usage;
            let isIncremental = false;
            if (this.config.incremental) {
                const result = await this.syncIncremental(docFile, blockNames, files, currentDoc);
                newDoc = result.content;
                usage = { totalTokens: result.tokenUsage || 0 };
                isIncremental = result.isIncremental;
                if (isIncremental) {
                    console.log(`  [Incremental] Detected changes in ${result.changedSections?.length || 0} sections`);
                }
            }
            else {
                const codeSummary = buildCodeContext(files, this.config.maxCodeChars, {
                    smartBudget: this.config.smartBudget,
                    budgetStrategy: this.config.budgetStrategy,
                    maxTokens: this.config.maxTokens,
                    fileImportanceHistory: this.fileImportanceHistory
                });
                const fileList = files.map(f => f.relPath).join(', ');
                const generateResult = await generateText({
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
                newDoc = generateResult.text;
                usage = generateResult.usage;
            }
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
                results.push({
                    docFile,
                    changed: true,
                    warnings,
                    preview,
                    tokenUsage: usage?.totalTokens,
                    isIncremental
                });
                if (this.config.dryRun || this.config.check) {
                    console.log(`  Pending update for ${docFile}`);
                    console.log(preview);
                    continue;
                }
                await fs.ensureDir(path.dirname(docPath));
                await fs.writeFile(docPath, newDoc.trim());
                console.log(`Updated ${docFile}`);
                if (this.config.incremental) {
                    this.saveCache();
                }
            }
            else {
                results.push({
                    docFile,
                    changed: false,
                    warnings,
                    tokenUsage: usage?.totalTokens,
                    isIncremental
                });
                console.log(`${docFile} is already in sync.`);
            }
        }
        if (this.config.check && results.some(result => result.changed)) {
            throw new Error('Documentation is out of sync. Run doc-architect without --check to update files.');
        }
        console.log('Synchronization complete.');
        return results;
    }
    async groupFilesByBlock() {
        const files = await glob(this.config.include, { cwd: this.config.sourceRoot });
        const groups = {};
        for (const relPath of files.sort((a, b) => a.localeCompare(b))) {
            const normalizedRelPath = relPath.replace(/\\/g, '/');
            const parts = normalizedRelPath.split('/');
            const block = parts[0];
            if (!block)
                continue;
            const content = await fs.readFile(path.join(this.config.sourceRoot, normalizedRelPath), 'utf-8');
            if (!groups[block])
                groups[block] = [];
            groups[block].push({ relPath: parts.slice(1).join('/'), content });
        }
        return groups;
    }
    loadCache() {
        try {
            const cachePath = path.join(this.config.cacheDir, 'cache.json');
            if (fs.existsSync(cachePath)) {
                const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                this.cache = new Map(Object.entries(data));
                console.log(`Loaded cache with ${this.cache.size} entries`);
            }
        }
        catch (err) {
            console.warn('Failed to load cache:', err);
        }
    }
    saveCache() {
        try {
            fs.ensureDirSync(this.config.cacheDir);
            const cachePath = path.join(this.config.cacheDir, 'cache.json');
            const data = Object.fromEntries(this.cache);
            fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
            console.log(`Saved cache with ${this.cache.size} entries`);
            if (this.config.smartBudget) {
                this.saveImportanceHistory();
            }
        }
        catch (err) {
            console.warn('Failed to save cache:', err);
        }
    }
    loadImportanceHistory() {
        try {
            const historyPath = path.join(this.config.cacheDir, 'importance-history.json');
            if (fs.existsSync(historyPath)) {
                const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
                this.fileImportanceHistory = new Map(Object.entries(data).map(([k, v]) => [k, v]));
                console.log(`Loaded importance history with ${this.fileImportanceHistory.size} entries`);
            }
        }
        catch (err) {
            console.warn('Failed to load importance history:', err);
        }
    }
    saveImportanceHistory() {
        try {
            fs.ensureDirSync(this.config.cacheDir);
            const historyPath = path.join(this.config.cacheDir, 'importance-history.json');
            const data = Object.fromEntries(this.fileImportanceHistory);
            fs.writeFileSync(historyPath, JSON.stringify(data, null, 2));
            console.log(`Saved importance history with ${this.fileImportanceHistory.size} entries`);
        }
        catch (err) {
            console.warn('Failed to save importance history:', err);
        }
    }
    computeFileHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    extractTypeScriptSignatures(content, filePath) {
        const signatures = new Map();
        try {
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            const visit = (node) => {
                if (ts.isClassDeclaration(node) && node.name) {
                    const members = [];
                    node.members.forEach(member => {
                        if (ts.isMethodDeclaration(member) && member.name) {
                            const methodName = member.name.getText(sourceFile);
                            const params = member.parameters.map(p => p.getText(sourceFile)).join(', ');
                            members.push(`method:${methodName}(${params})`);
                        }
                        else if (ts.isPropertyDeclaration(member) && member.name) {
                            members.push(`property:${member.name.getText(sourceFile)}`);
                        }
                    });
                    signatures.set(`class:${node.name.getText(sourceFile)}`, members.join('|'));
                }
                else if (ts.isFunctionDeclaration(node) && node.name) {
                    const params = node.parameters.map(p => p.getText(sourceFile)).join(', ');
                    signatures.set(`function:${node.name.getText(sourceFile)}`, params);
                }
                else if (ts.isInterfaceDeclaration(node) && node.name) {
                    const members = node.members.map(m => m.getText(sourceFile)).join('|');
                    signatures.set(`interface:${node.name.getText(sourceFile)}`, members);
                }
                ts.forEachChild(node, visit);
            };
            visit(sourceFile);
        }
        catch (err) {
            // Ignore TypeScript parsing errors for non-TS files
        }
        return signatures;
    }
    async syncIncremental(docFile, blockNames, files, currentDoc) {
        const cacheKey = `doc:${docFile}`;
        const fileSignatures = [];
        const changedSections = [];
        for (const file of files) {
            const hash = this.computeFileHash(file.content);
            const apiSignatures = file.relPath.endsWith('.ts') || file.relPath.endsWith('.tsx')
                ? this.extractTypeScriptSignatures(file.content, file.relPath)
                : new Map();
            fileSignatures.push({ relPath: file.relPath, hash, apiSignatures });
        }
        const currentSignature = JSON.stringify(fileSignatures.map(fs => ({
            relPath: fs.relPath,
            hash: fs.hash,
            apiSignatures: Array.from(fs.apiSignatures.entries())
        })));
        const cachedEntry = this.cache.get(cacheKey);
        if (cachedEntry) {
            const oldSignatures = JSON.parse(cachedEntry.hash);
            let hasChanges = false;
            for (let i = 0; i < fileSignatures.length; i++) {
                const current = fileSignatures[i];
                const old = oldSignatures[i];
                if (!old || current.hash !== old.hash) {
                    hasChanges = true;
                    changedSections.push(current.relPath);
                    if (current.apiSignatures.size > 0 && old?.apiSignatures) {
                        const oldSigMap = new Map(old.apiSignatures);
                        for (const [key, value] of current.apiSignatures.entries()) {
                            if (oldSigMap.get(key) !== value) {
                                console.log(`  API change detected in ${current.relPath}: ${key}`);
                            }
                        }
                    }
                }
            }
            if (!hasChanges && currentDoc === cachedEntry.content) {
                return {
                    content: cachedEntry.content,
                    tokenUsage: 0,
                    isIncremental: false
                };
            }
            if (!hasChanges) {
                return {
                    content: currentDoc,
                    tokenUsage: 0,
                    isIncremental: false
                };
            }
        }
        const codeSummary = buildCodeContext(files, this.config.maxCodeChars, {
            smartBudget: this.config.smartBudget,
            budgetStrategy: this.config.budgetStrategy,
            maxTokens: this.config.maxTokens,
            fileImportanceHistory: this.fileImportanceHistory
        });
        const fileList = files.map(f => f.relPath).join(', ');
        const prompt = hasChangesInCurrentDoc(currentDoc, fileSignatures, cachedEntry)
            ? `
OBJECTIVE: Update ONLY the sections of documentation affected by recent code changes.

CHANGED FILES: ${changedSections.join(', ')}

CURRENT DOCUMENTATION:
${currentDoc || '[Empty - New Document]'}

SOURCE CODE CONTEXT (focus on changed files):
${codeSummary}

TASK: Return the full updated markdown content, but only modify sections related to the changed files.
Keep unchanged sections identical to the current documentation.
ONLY return the markdown content.
`
            : `
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
`;
        const { text: newDoc, usage } = await generateText({
            model: this.modelInstance,
            system: `You are DocArchitect, an elite documentation engineer.
Your task is to keep technical documentation in sync with the source code.
You write documentation for developers. It should read like an extension of the code: clear, structured, technically dense, and readable.

CRITICAL RULE: Focus on the architecture. Do not just summarize files. Explain how these files interact to form the "${blockNames.join(', ')}" logic.
Link functions across files and explain the data flow. Use Mermaid diagrams if they help visualize relationships.`,
            prompt,
            temperature: 0.1,
        });
        this.cache.set(cacheKey, {
            hash: currentSignature,
            content: newDoc,
            timestamp: Date.now(),
            tokenUsage: usage?.totalTokens || 0
        });
        return {
            content: newDoc,
            tokenUsage: usage?.totalTokens || 0,
            isIncremental: !!cachedEntry,
            changedSections
        };
    }
}
export function groupBlocksByDocument(blocks, mappings) {
    const grouped = new Map();
    for (const [block, files] of Object.entries(blocks)) {
        const docFile = mappings[block];
        if (!docFile)
            continue;
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
export function buildCodeContext(files, maxChars, options) {
    const { smartBudget = false, budgetStrategy = 'balanced', maxTokens = 4096, fileImportanceHistory = new Map() } = options || {};
    let remaining = Math.max(0, maxChars);
    const sections = [];
    let sortedFiles = [...files];
    if (smartBudget && fileImportanceHistory.size > 0) {
        sortedFiles = sortedFiles.map(file => ({
            ...file,
            importanceScore: fileImportanceHistory.get(file.relPath) || calculateFileImportance(file)
        })).sort((a, b) => {
            const scoreA = a.importanceScore || 0;
            const scoreB = b.importanceScore || 0;
            switch (budgetStrategy) {
                case 'coverage':
                    return scoreB - scoreA;
                case 'depth':
                    return scoreA - scoreB;
                case 'balanced':
                default:
                    return scoreB - scoreA;
            }
        });
    }
    else {
        sortedFiles = sortedFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));
    }
    for (const file of sortedFiles) {
        const header = `--- File: ${file.relPath} ---\n`;
        if (smartBudget && file.importanceScore !== undefined) {
            const importanceFactor = Math.min(1.5, Math.max(0.5, file.importanceScore / 5));
            if (budgetStrategy === 'depth' && importanceFactor < 0.8) {
                if (remaining > header.length + 200) {
                    sections.push(`${header}[Summarized: Low priority file - ${file.content.length} bytes]\n`);
                    remaining -= header.length + 50;
                }
                continue;
            }
        }
        if (remaining <= header.length) {
            sections.push(`--- File: ${file.relPath} ---\n[Omitted: context budget exhausted before this file.]`);
            continue;
        }
        let budgetForContent = remaining - header.length;
        if (smartBudget && file.importanceScore !== undefined) {
            const importanceFactor = Math.min(2.0, Math.max(0.3, file.importanceScore / 5));
            budgetForContent = Math.min(budgetForContent, Math.floor(maxChars * importanceFactor / sortedFiles.length));
        }
        const included = file.content.slice(0, budgetForContent);
        const truncatedNote = included.length < file.content.length
            ? `\n[Truncated: ${file.content.length - included.length} characters omitted from this file.]`
            : '';
        sections.push(`${header}${included}${truncatedNote}`);
        remaining -= header.length + included.length + truncatedNote.length;
    }
    return sections.join('\n\n');
}
export function calculateFileImportance(file) {
    let score = 5;
    const ext = path.extname(file.relPath).toLowerCase();
    if (['.ts', '.tsx', '.rs', '.go', '.java'].includes(ext)) {
        score += 1;
    }
    const fileName = path.basename(file.relPath).toLowerCase();
    if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) {
        score += 2;
    }
    if (file.relPath.includes('/api/') || file.relPath.includes('/core/') || file.relPath.includes('/lib/')) {
        score += 1.5;
    }
    const lines = file.content.split('\n').length;
    if (lines > 500) {
        score += 1;
    }
    else if (lines > 200) {
        score += 0.5;
    }
    const exportCount = (file.content.match(/\bexport\s+(class|function|interface|type|const|let|var)\b/g) || []).length;
    score += Math.min(2, exportCount * 0.5);
    const complexityIndicators = [
        /\b(class|interface|enum|namespace)\s+\w+/g,
        /\b(async|await|Promise|Observable)\b/g,
        /\b(generic|template|macro)\b/gi
    ];
    for (const regex of complexityIndicators) {
        const matches = file.content.match(regex);
        if (matches && matches.length > 0) {
            score += Math.min(1, matches.length * 0.2);
        }
    }
    return Math.min(10, Math.max(1, score));
}
export async function validateMarkdownReferences(markdown, docsRoot, sourceRoot) {
    const warnings = [];
    const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
    const roots = [docsRoot, sourceRoot].map(root => path.resolve(root));
    let match;
    while ((match = linkPattern.exec(markdown)) !== null) {
        const rawTarget = match[1].trim();
        const target = rawTarget.split('#')[0].trim();
        if (!target || /^(https?:|mailto:|#)/i.test(target))
            continue;
        if (target.startsWith('data:'))
            continue;
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
export function createChangePreview(before, after, maxLines = 80) {
    const beforeLines = before.split(/\r?\n/);
    const afterLines = after.split(/\r?\n/);
    const preview = [
        `--- current (${beforeLines.length} lines)`,
        `+++ proposed (${afterLines.length} lines)`
    ];
    const limit = Math.min(Math.max(beforeLines.length, afterLines.length), maxLines);
    for (let i = 0; i < limit; i++) {
        const oldLine = beforeLines[i];
        const newLine = afterLines[i];
        if (oldLine === newLine)
            continue;
        if (oldLine !== undefined)
            preview.push(`- ${oldLine}`);
        if (newLine !== undefined)
            preview.push(`+ ${newLine}`);
    }
    const totalChanged = Math.abs(afterLines.length - beforeLines.length)
        + afterLines.filter((line, index) => line !== beforeLines[index]).length;
    if (preview.length === 2)
        preview.push('(content changed only by trailing whitespace)');
    if (totalChanged > maxLines)
        preview.push(`... ${totalChanged - maxLines} additional changed lines not shown`);
    return preview.join('\n');
}
export function hasChangesInCurrentDoc(currentDoc, fileSignatures, cachedEntry) {
    return !!cachedEntry;
}
