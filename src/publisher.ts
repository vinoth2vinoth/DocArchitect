import { Octokit } from "@octokit/rest";
import fs from 'fs-extra';
import path from 'node:path';
import glob from 'fast-glob';

export async function publishToGithub(repoName: string, token: string, sourceDir: string) {
  const octokit = new Octokit({ auth: token });
  
  console.log(`🚀 Creating repository: ${repoName}...`);
  
  try {
    // 1. Create or Get the repository
    let repo;
    try {
        const { data } = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description: "Architecture-aware documentation generator powered by AI (DeepSeek).",
          private: false,
          auto_init: true,
        });
        repo = data;
        console.log(`✅ Repository created: ${repo.html_url}`);
    } catch (e: any) {
        if (e.status === 422) {
            console.log(`ℹ️ Repository already exists, fetching existing info...`);
            const { data } = await octokit.repos.get({
                owner: (await octokit.users.getAuthenticated()).data.login,
                repo: repoName
            });
            repo = data;
        } else {
            throw e;
        }
    }

    const owner = repo.owner.login;
    const name = repo.name;

    // 2. Get file list
    const files = await glob('**/*', { 
        cwd: sourceDir, 
        dot: true,
        ignore: ['node_modules/**', 'dist/**', '.env', 'doc-architect.json']
    });

    console.log(`📦 Uploading ${files.length} files...`);

    for (const file of files) {
        const content = await fs.readFile(path.join(sourceDir, file));
        try {
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo: name,
                path: file,
                message: `Upload ${file}`,
                content: content.toString('base64'),
                branch: 'main'
            });
            console.log(`  ✅ Uploaded: ${file}`);
        } catch (err: any) {
            console.error(`  ❌ Failed to upload ${file}:`, err.message);
        }
    }

    console.log(`✨ Successfully pushed to main branch!`);
    return repo.html_url;

  } catch (error: any) {
    console.error('❌ Failed to publish:', error.message);
    if (error.response?.data) {
        console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}
