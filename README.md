# DocArchitect

DocArchitect is a local, architecture-aware documentation sync tool for keeping Markdown docs close to the code they describe.

It is designed for guarded documentation updates, not unattended rewrites. The sync engine groups all source blocks that target the same Markdown file into one generation pass, validates local Markdown links, and supports dry-run/check modes before writing files.

## Quick Start

```bash
npm run sync-docs -- --dry-run
npm run sync-docs
```

Set one provider key in your environment:

```bash
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

## Configuration

Create `doc-architect.json` in the repository root:

```json
{
  "sourceRoot": "./src/framework",
  "docsRoot": "./readme",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "maxCodeChars": 30000,
  "include": ["**/*.{ts,tsx,js,jsx}", "**/*.py"],
  "mappings": {
    "core": "core-orchestration.md",
    "orchestration": "core-orchestration.md",
    "memory": "memory-layer.md"
  }
}
```

When multiple source blocks map to the same document, DocArchitect analyzes them together and writes the document once. This prevents later blocks from overwriting earlier updates.

## Safe Modes

| Command | Behavior |
| --- | --- |
| `npm run sync-docs -- --dry-run` | Generates docs and prints a change preview without writing files. |
| `npm run sync-docs -- --check` | Exits non-zero if generated docs would change files. Useful for CI. |
| `npm run sync-docs -- --no-validate-links` | Skips local Markdown link validation. |
| `npm run sync-docs -- --fail-on-validation-warnings` | Treats broken local links as fatal. |

## GitHub Publish/Pull

The GitHub publisher is safe by default:

- Creates private repositories unless explicitly configured otherwise.
- Publishes to a sync branch, not directly to `main`.
- Opens a pull request for review.
- Ignores common secret and build-output patterns such as `.env*`, `*.pem`, `*.key`, `node_modules`, and `dist`.

The puller does not overwrite changed local files by default. If remote content differs from an existing file, it writes a sibling `.incoming` file and reports a conflict for manual review.

## Current Limits

DocArchitect still depends on an LLM for content generation. Treat it as an assisted documentation workflow:

- Review generated diffs before merging.
- Prefer `--check` in CI.
- Keep mappings small enough that the relevant code fits in the context budget.
- Add conventional tests for critical architecture claims where possible.
