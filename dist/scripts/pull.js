import { pullFromGithub } from '../src/puller.js';
import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
async function run() {
    const token = process.env.GITHUB_TOKEN;
    const repoName = 'DocArchitect';
    const targetDir = path.join(process.cwd(), 'doc-architect');
    if (!token) {
        console.error('Error: GITHUB_TOKEN is not set in environment variables.');
        process.exit(1);
    }
    try {
        const result = await pullFromGithub(repoName, token, targetDir, {
            overwrite: false
        });
        console.log(`\nLocal workspace pull complete. Written: ${result.written.length}. Conflicts: ${result.conflicts.length}.`);
        if (result.conflicts.length > 0) {
            console.log('Review .incoming files before applying remote changes.');
        }
    }
    catch {
        process.exit(1);
    }
}
run();
