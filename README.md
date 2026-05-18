# DocArchitect 🏗️

**Documentation as Architecture.** 

DocArchitect is an AI-powered CLI tool designed to keep your technical documentation perfectly synchronized with your source code. It treats your codebase as the source of truth and uses DeepSeek's advanced reasoning to update your markdown files whenever your architecture evolves.

## ⚔️ Why DocArchitect?

| Feature | SaaS Tools (Mintlify, etc.) | **DocArchitect** |
| :--- | :--- | :--- |
| **Data Privacy** | Code snapshots stored on their Cloud | **Your machine, your rules.** Code never leaves your control except for LLM processing. |
| **Model Choice** | Locked to their provider | **Bring Your Own Key.** Use OpenAI, Claude, or DeepSeek. |
| **Cost** | High monthly subscriptions | **Pay-as-you-go tokens.** 90% cheaper for most teams. |
| **Intelligence** | File summaries | **Architectural awareness.** Maps relationships across your codebase. |

## 🚀 Getting Started

### 1. Installation

```bash
npm install -g doc-architect
```

### 2. Configure Your Keys

DocArchitect automatically detects your API keys:
- `DEEPSEEK_API_KEY` (Recommended for cost 🤑)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 3. Create a Configuration

Create `doc-architect.json`:

```json
{
  "sourceRoot": "./src",
  "docsRoot": "./docs",
  "provider": "deepseek",
  "mappings": {
    "auth": "authentication.md",
    "db": "database-layer.md"
  }
}
```

### 4. Run

```bash
doc-architect
```

## 🛠 Advanced Config

| Option | Description | Default |
| :--- | :--- | :--- |
| `provider` | `openai` \| `anthropic` \| `google` \| `deepseek` | `deepseek` |
| `maxCodeChars` | Max characters per block (context window) | `30000` |
| `include` | Glob patterns for source files | `["**/*.{ts,tsx...}"]` |

## GitHub Action Example

Maintain perfect docs on every push:

```yaml
steps:
  - uses: actions/checkout@v4
  - name: DocArchitect Sync
    run: npx doc-architect
    env:
      DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

name: Auto-Sync Docs
on:
  push:
    paths: ['src/**']
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g doc-architect
      - run: doc-architect
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

## License
MIT
