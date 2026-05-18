# DocArchitect 🏗️

**Documentation as Architecture.** 

DocArchitect is an AI-powered CLI tool designed to keep your technical documentation perfectly synchronized with your source code. It treats your codebase as the source of truth and uses DeepSeek's advanced reasoning to update your markdown files whenever your architecture evolves.

## Features

- **Multi-LLM Support**: Built-in support for OpenAI, Anthropic, Google (Gemini), and DeepSeek via Vercel AI SDK.
- **Architecture-Aware**: Understands relationships between files, not just individual summaries.
- **Language Agnostic**: Support for TypeScript, Python, Go, Rust, Java, and more out of the box.
- **Dynamic Updates**: Automatically adds new features and removes deprecated sections in your docs.
- **CI/CD Ready**: Easy integration with GitHub Actions.

## 🚀 Getting Started

### 1. Installation

```bash
npm install -g doc-architect
```

### 2. Configure Your Keys

DocArchitect automatically detects your API keys from environment variables:
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 3. Create a Configuration

Create a `doc-architect.json` at your project root:

```json
{
  "sourceRoot": "./src",
  "docsRoot": "./docs",
  "provider": "openai",
  "model": "gpt-4o",
  "mappings": {
    "core": "architecture.md",
    "api": "api-reference.md"
  }
}
```

*Note: If `provider` is omitted, it defaults to `deepseek` or auto-detects based on available keys.*

### 4. Run

```bash
doc-architect
```

## 🛠 Advanced Config

| Option | Description | Default |
| :--- | :--- | :--- |
| `provider` | `openai` \| `anthropic` \| `google` \| `deepseek` | `deepseek` |
| `model` | Specific model ID | Provider default |
| `sourceRoot` | Path to source code | `./src` |
| `docsRoot` | Path where docs are stored | `./docs` |
| `include` | Glob patterns for source files | `["**/*.{ts,tsx...}"]` |

## GitHub Action Example

```yaml
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
