import fs from 'fs-extra';
import path from 'node:path';
import glob from 'fast-glob';
export class DocumentationHealth {
    docsRoot;
    sourceRoot;
    cacheDir;
    mappings;
    constructor(docsRoot, sourceRoot, cacheDir, mappings) {
        this.docsRoot = path.resolve(docsRoot);
        this.sourceRoot = path.resolve(sourceRoot);
        this.cacheDir = path.resolve(cacheDir);
        this.mappings = mappings;
    }
    async analyze() {
        console.log('Analyzing documentation health...');
        const coverage = await this.analyzeCoverage();
        const freshness = await this.analyzeFreshness();
        const linkHealth = await this.analyzeLinkHealth();
        const tokenEfficiency = await this.analyzeTokenEfficiency();
        const overallScore = this.calculateOverallScore(coverage, freshness, linkHealth, tokenEfficiency);
        const recommendations = this.generateRecommendations(coverage, freshness, linkHealth, tokenEfficiency);
        return {
            overallScore,
            coverage,
            freshness,
            linkHealth,
            tokenEfficiency,
            recommendations
        };
    }
    async analyzeCoverage() {
        const sourceFiles = await glob('**/*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,h,cs}', {
            cwd: this.sourceRoot
        });
        const documentedFiles = new Set();
        // Map blocks to their documentation files
        for (const [block, docFile] of Object.entries(this.mappings)) {
            const blockPath = path.join(this.sourceRoot, block);
            if (await fs.pathExists(blockPath)) {
                const blockFiles = await glob('**/*', { cwd: blockPath });
                blockFiles.forEach(file => {
                    documentedFiles.add(path.join(block, file));
                });
            }
        }
        const totalFiles = sourceFiles.length;
        const documentedCount = documentedFiles.size;
        const percentage = totalFiles > 0 ? (documentedCount / totalFiles) * 100 : 0;
        return {
            documentedFiles: documentedCount,
            totalFiles,
            percentage: Math.round(percentage * 100) / 100
        };
    }
    async analyzeFreshness() {
        const staleDocuments = [];
        let totalAgeDays = 0;
        let documentCount = 0;
        for (const docFile of Object.values(this.mappings)) {
            const docPath = path.join(this.docsRoot, docFile);
            if (!await fs.pathExists(docPath))
                continue;
            const docStats = await fs.stat(docPath);
            const docMtime = docStats.mtimeMs;
            // Find all source files that map to this document
            const relatedSourceFiles = [];
            for (const [block, mappedDoc] of Object.entries(this.mappings)) {
                if (mappedDoc !== docFile)
                    continue;
                const blockPath = path.join(this.sourceRoot, block);
                if (!await fs.pathExists(blockPath))
                    continue;
                const blockFiles = await glob('**/*', { cwd: blockPath });
                for (const file of blockFiles) {
                    const filePath = path.join(blockPath, file);
                    const stats = await fs.stat(filePath);
                    // If source file was modified after doc, it's stale
                    if (stats.mtimeMs > docMtime) {
                        relatedSourceFiles.push(path.join(block, file));
                    }
                }
            }
            const ageDays = (Date.now() - docMtime) / (1000 * 60 * 60 * 24);
            totalAgeDays += ageDays;
            documentCount++;
            if (relatedSourceFiles.length > 0 || ageDays > 30) {
                staleDocuments.push({
                    docFile,
                    ageDays: Math.round(ageDays * 10) / 10,
                    changedSourceFiles: relatedSourceFiles
                });
            }
        }
        const averageAgeDays = documentCount > 0 ? totalAgeDays / documentCount : 0;
        // Score: 100 if no stale docs, decreases with more stale docs
        const staleRatio = documentCount > 0 ? staleDocuments.length / documentCount : 0;
        const score = Math.max(0, Math.round((1 - staleRatio) * 100));
        return {
            averageAgeDays: Math.round(averageAgeDays * 10) / 10,
            staleDocuments,
            score
        };
    }
    async analyzeLinkHealth() {
        let totalLinks = 0;
        let brokenLinks = 0;
        for (const docFile of Object.values(this.mappings)) {
            const docPath = path.join(this.docsRoot, docFile);
            if (!await fs.pathExists(docPath))
                continue;
            const content = await fs.readFile(docPath, 'utf-8');
            const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
            let match;
            while ((match = linkPattern.exec(content)) !== null) {
                const target = match[1].trim().split('#')[0].trim();
                if (!target || /^(https?:|mailto:|#)/i.test(target) || target.startsWith('data:'))
                    continue;
                totalLinks++;
                const decoded = decodeURIComponent(target);
                const exists = [this.docsRoot, this.sourceRoot]
                    .map(root => path.resolve(root, decoded))
                    .some(candidate => fs.existsSync(candidate));
                if (!exists) {
                    brokenLinks++;
                }
            }
        }
        const score = totalLinks > 0 ? Math.round(((totalLinks - brokenLinks) / totalLinks) * 100) : 100;
        return {
            totalLinks,
            brokenLinks,
            score
        };
    }
    async analyzeTokenEfficiency() {
        const cachePath = path.join(this.cacheDir, 'cache.json');
        if (!await fs.pathExists(cachePath)) {
            return {
                totalTokensUsed: 0,
                averageTokensPerDoc: 0,
                cacheHitRate: 0
            };
        }
        const cacheData = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
        const entries = Object.values(cacheData);
        const totalTokens = entries.reduce((sum, entry) => sum + (entry.tokenUsage || 0), 0);
        const averageTokens = entries.length > 0 ? totalTokens / entries.length : 0;
        // Estimate cache hit rate based on zero-token entries (skipped generations)
        const cacheHits = entries.filter(e => e.tokenUsage === 0).length;
        const cacheHitRate = entries.length > 0 ? Math.round((cacheHits / entries.length) * 100) : 0;
        return {
            totalTokensUsed: totalTokens,
            averageTokensPerDoc: Math.round(averageTokens),
            cacheHitRate
        };
    }
    calculateOverallScore(coverage, freshness, linkHealth, tokenEfficiency) {
        // Weighted average: coverage (30%), freshness (30%), links (25%), efficiency (15%)
        const weights = {
            coverage: 0.30,
            freshness: 0.30,
            links: 0.25,
            efficiency: 0.15
        };
        const coverageScore = coverage.percentage;
        const freshnessScore = freshness.score;
        const linkScore = linkHealth.score;
        const efficiencyScore = tokenEfficiency.cacheHitRate > 0 ?
            Math.min(100, tokenEfficiency.cacheHitRate + 20) : 50;
        const overall = coverageScore * weights.coverage +
            freshnessScore * weights.freshness +
            linkScore * weights.links +
            efficiencyScore * weights.efficiency;
        return Math.round(overall);
    }
    generateRecommendations(coverage, freshness, linkHealth, tokenEfficiency) {
        const recommendations = [];
        // Coverage recommendations
        if (coverage.percentage < 50) {
            recommendations.push({
                priority: 'high',
                category: 'coverage',
                message: `Only ${coverage.percentage}% of source files are documented`,
                action: 'Add more block mappings in configuration to cover uncovered directories'
            });
        }
        else if (coverage.percentage < 80) {
            recommendations.push({
                priority: 'medium',
                category: 'coverage',
                message: `${coverage.percentage}% coverage - consider documenting remaining files`,
                action: 'Review undocumented directories and add them to mappings'
            });
        }
        // Freshness recommendations
        if (freshness.staleDocuments.length > 0) {
            const criticalStale = freshness.staleDocuments.filter(d => d.changedSourceFiles.length > 0);
            if (criticalStale.length > 0) {
                recommendations.push({
                    priority: 'high',
                    category: 'freshness',
                    message: `${criticalStale.length} document(s) have outdated content due to code changes`,
                    action: `Run doc-architect to sync: ${criticalStale.map(d => d.docFile).join(', ')}`
                });
            }
            const oldDocs = freshness.staleDocuments.filter(d => d.ageDays > 60 && d.changedSourceFiles.length === 0);
            if (oldDocs.length > 0) {
                recommendations.push({
                    priority: 'low',
                    category: 'freshness',
                    message: `${oldDocs.length} document(s) haven't been reviewed in over 60 days`,
                    action: 'Schedule regular documentation reviews'
                });
            }
        }
        // Link health recommendations
        if (linkHealth.brokenLinks > 0) {
            recommendations.push({
                priority: 'high',
                category: 'links',
                message: `${linkHealth.brokenLinks} broken link(s) detected in documentation`,
                action: 'Fix broken references or update --validate-links behavior'
            });
        }
        // Token efficiency recommendations
        if (tokenEfficiency.cacheHitRate === 0 && tokenEfficiency.totalTokensUsed > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'efficiency',
                message: 'Incremental caching not enabled or not being utilized',
                action: 'Enable --incremental flag to reduce token usage'
            });
        }
        else if (tokenEfficiency.averageTokensPerDoc > 5000) {
            recommendations.push({
                priority: 'low',
                category: 'efficiency',
                message: `High average token usage (${tokenEfficiency.averageTokensPerDoc} tokens/doc)`,
                action: 'Consider splitting large documentation files or using smart context budgeting'
            });
        }
        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    printReport(metrics) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 DOCUMENTATION HEALTH REPORT');
        console.log('='.repeat(60));
        const scoreColor = metrics.overallScore >= 80 ? '🟢' : metrics.overallScore >= 60 ? '🟡' : '🔴';
        console.log(`\n${scoreColor} Overall Score: ${metrics.overallScore}/100\n`);
        console.log('📁 COVERAGE');
        console.log(`   Documented: ${metrics.coverage.documentedFiles}/${metrics.coverage.totalFiles} files (${metrics.coverage.percentage}%)`);
        console.log('\n🕐 FRESHNESS');
        console.log(`   Average Age: ${metrics.freshness.averageAgeDays} days`);
        console.log(`   Stale Documents: ${metrics.freshness.staleDocuments.length}`);
        console.log(`   Score: ${metrics.freshness.score}/100`);
        console.log('\n🔗 LINK HEALTH');
        console.log(`   Total Links: ${metrics.linkHealth.totalLinks}`);
        console.log(`   Broken Links: ${metrics.linkHealth.brokenLinks}`);
        console.log(`   Score: ${metrics.linkHealth.score}/100`);
        console.log('\n⚡ TOKEN EFFICIENCY');
        console.log(`   Total Tokens Used: ${metrics.tokenEfficiency.totalTokensUsed.toLocaleString()}`);
        console.log(`   Average per Doc: ${metrics.tokenEfficiency.averageTokensPerDoc.toLocaleString()}`);
        console.log(`   Cache Hit Rate: ${metrics.tokenEfficiency.cacheHitRate}%`);
        if (metrics.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS');
            metrics.recommendations.forEach((rec, i) => {
                const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '⚪';
                console.log(`   ${icon} [${rec.category.toUpperCase()}] ${rec.message}`);
                if (rec.action) {
                    console.log(`      → ${rec.action}`);
                }
            });
        }
        console.log('\n' + '='.repeat(60) + '\n');
    }
}
