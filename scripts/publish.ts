import { publishToGithub } from '../src/publisher.js';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

async function run() {
    const token = process.env.GITHUB_TOKEN;
    const repoName = 'DocArchitect';
    const sourceDir = path.join(process.cwd(), 'doc-architect');

    if (!token) {
        console.error('Error: GITHUB_TOKEN is not set in environment variables.');
        process.exit(1);
    }

    try {
        const result = await publishToGithub(repoName, token, sourceDir, {
            private: true,
            createPullRequest: true
        });

        console.log('\nDocArchitect sync branch published.');
        console.log(`Repo URL: ${result.repoUrl}`);
        console.log(`Branch: ${result.branchName}`);
        if (result.pullRequestUrl) {
            console.log(`Pull Request: ${result.pullRequestUrl}`);
        }
    } catch {
        process.exit(1);
    }
}

run();
