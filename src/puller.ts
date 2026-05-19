import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import path from 'node:path';

export interface PullOptions {
  branch?: string;
  overwrite?: boolean;
}

export interface PullResult {
  written: string[];
  conflicts: Array<{ path: string; incomingPath: string }>;
}

export async function pullFromGithub(repoName: string, token: string, targetDir: string, options: PullOptions = {}): Promise<PullResult> {
  const octokit = new Octokit({ auth: token });
  const branch = options.branch || 'main';
  const overwrite = options.overwrite ?? false;
  const root = path.resolve(targetDir);
  const result: PullResult = { written: [], conflicts: [] };

  console.log(`Pulling repository: ${repoName} (${branch})...`);

  try {
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;

    const { data: ref } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${branch}`
    });
    const latestCommitSha = ref.object.sha;

    const { data: tree } = await octokit.git.getTree({
      owner,
      repo: repoName,
      tree_sha: latestCommitSha,
      recursive: 'true'
    });

    console.log(`Found ${tree.tree.length} items in remote tree.`);

    for (const item of tree.tree) {
      if (item.type !== 'blob' || !item.path) continue;
      if (shouldSkipRemotePath(item.path)) continue;

      const filePath = safeJoin(root, item.path);
      if (!filePath) {
        throw new Error(`Remote path escapes target directory: ${item.path}`);
      }

      console.log(`  Fetching: ${item.path}`);

      const { data } = await octokit.repos.getContent({
        owner,
        repo: repoName,
        path: item.path,
        ref: branch
      });

      if (Array.isArray(data) || !('content' in data)) continue;

      const content = Buffer.from(data.content, 'base64');
      await fs.ensureDir(path.dirname(filePath));

      if (!overwrite && await fs.pathExists(filePath)) {
        const existing = await fs.readFile(filePath);
        if (!existing.equals(content)) {
          const incomingPath = `${filePath}.incoming`;
          await fs.writeFile(incomingPath, content);
          result.conflicts.push({ path: item.path, incomingPath });
          console.warn(`  Conflict preserved as: ${incomingPath}`);
          continue;
        }
      }

      await fs.writeFile(filePath, content);
      result.written.push(item.path);
    }

    console.log(`Pull complete. Written: ${result.written.length}. Conflicts: ${result.conflicts.length}.`);
    return result;
  } catch (error: any) {
    console.error('Failed to pull:', error.message);
    throw error;
  }
}

function shouldSkipRemotePath(remotePath: string): boolean {
  return remotePath === '.env'
    || remotePath.startsWith('.env.')
    || remotePath.includes('node_modules/')
    || remotePath.includes('/node_modules/')
    || remotePath.startsWith('.git/')
    || remotePath.endsWith('.pem')
    || remotePath.endsWith('.key');
}

function safeJoin(root: string, requestedPath: string): string | null {
  const targetPath = path.resolve(root, requestedPath);
  const relativePath = path.relative(root, targetPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  return targetPath;
}
