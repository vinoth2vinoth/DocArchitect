import { publishToGithub } from '../src/publisher.js';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

async function run() {
    const token = process.env.GITHUB_TOKEN;
    const repoName = "DocArchitect"; // You can change this
    const sourceDir = path.join(process.cwd(), 'doc-architect');

    if (!token) {
        console.error("❌ Error: GITHUB_TOKEN is not set in environment variables.");
        console.log("Please add your GitHub Personal Access Token to the Settings menu.");
        process.exit(1);
    }

    try {
        const url = await publishToGithub(repoName, token, sourceDir);
        console.log(`\n🎉 PROMOTED TO OPEN SOURCE!`);
        console.log(`🔗 Repo URL: ${url}`);
    } catch (err) {
        process.exit(1);
    }
}

run();
