# DocArchitect 🏗️ — The Ultimate AI-Powered Code Documentation Generator

[![DeepSeek-Direct](https://img.shields.io/badge/Model-DeepSeek--V3-blue?logo=deepseek)](https://deepseek.com)
[![License-MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![CLI-Ready](https://img.shields.io/badge/CLI-Ready-orange)](https://npmjs.com/package/doc-architect)

**Stop manual documentation. Start Architectural Sync.**

DocArchitect is a high-performance, **architecture-aware AI documentation engine** that turns your source code into professional-grade technical documentation. Unlike generic AI scripts, DocArchitect understands the relationships between your files, ensuring your markdown docs evolve alongside your system architecture.

---

## ⚡ The Enterprise-Grade Alternative to Mintlify & Swimm

DocArchitect is designed for developers who demand **privacy, cost-efficiency, and elite accuracy.**

| Feature | SaaS Tools (Mintlify, etc.) | **DocArchitect** |
| :--- | :--- | :--- |
| **Data Sovereignty** | Your code snapshots live in their cloud. | **100% Local Control.** Your code only hits the LLM via your secure API key. |
| **LLM Flexibility** | Locked to a single provider. | **BYOK (Bring Your Own Key).** Direct support for OpenAI, Claude, DeepSeek, and Google Gemini. |
| **Economic Scaling** | Expensive monthly per-user fees. | **Pay-as-you-go tokens.** Optimized for DeepSeek-V3 to reduce costs by 90%. |
| **Intelligence Depth** | Basic file-by-file summaries. | **Architecture-Aware.** Maps data flows and component relations across files. |

---

## 🔥 Key Features

- 🧠 **Architecture-Driven Reasoning**: Don't just summarize files—explain how your system works.
- 🔄 **Autonomous Auto-Sync**: Automatically updates sections, removes deprecated code references, and adds new features.
- 🎨 **Multi-LLM Integration**: Built on **Vercel AI SDK**. Seamlessly switch between `DeepSeek`, `GPT-4o`, `Claude 3.5 Sonnet`, and `Gemini 1.5 Pro`.
- 🌍 **Language Agnostic**: First-class support for **TypeScript, Python, Rust, Go, Java, C++, and Python**.
- 🛠 **CI/CD Native**: Seamless integration with GitHub Actions for hands-free documentation maintenance.

---

## 🚀 Quick Start in 60 Seconds

### 1. Installation
Install globally via NPM or use `npx` for a zero-install experience:
```bash
npm install -g doc-architect
```

### 2. Configure Your Environment
DocArchitect automatically detects your API keys from your environment. **DeepSeek is the recommended choice for high-intelligence logic at minimal cost.**

```bash
export DEEPSEEK_API_KEY="your_api_key"
# OR set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY
```

### 3. Initialize your Project
Create a `doc-architect.json` file in your root directory:

```json
{
  "sourceRoot": "./src",
  "docsRoot": "./docs",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "mappings": {
    "core-logic": "architecture.md",
    "api-v1": "api-reference.md",
    "auth-flow": "security.md"
  }
}
```

### 4. Sync Your Docs
```bash
doc-architect
```

---

## 🏗 Why "Architecture-Aware"?

Most AI doc tools treat files as isolated text islands. **DocArchitect sees the whole continent.** 

When you define a mapping, DocArchitect feeds the relevant code blocks into the LLM context, allowing it to understand:
1. **Dependency Graphs**: How Class A in `user.ts` interacts with Service B in `auth.ts`.
2. **Data Pipelines**: How an API request flows from the controller to the database layer.
3. **Implicit Logic**: The design patterns and architectural decisions that aren't obvious in single-file summaries.

---

## 🤖 Advanced Configuration Options

| Option | Description | Recommended |
| :--- | :--- | :--- |
| `provider` | Choose from `deepseek`, `openai`, `anthropic`, or `google`. | `deepseek` |
| `model` | Specific model ID (e.g., `gpt-4o`, `claude-3-5-sonnet`). | `deepseek-chat` |
| `maxCodeChars` | Maximum source code characters to analyze per block (context limit). | `30000` |
| `include` | Glob patterns for source files to be analyzed. | `["**/*.{ts,py,go...}"]` |

---

## 📦 CI/CD: Documentation on Autopilot

Keep your docs fresh on every git push with this GitHub Action:

```yaml
name: "DocArchitect Auto-Sync"
on:
  push:
    branches: [ main ]
    paths: [ 'src/**' ]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Auto-Sync Documentation
        run: npx doc-architect
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

---

## 🌐 Community & Support

- **Found a bug?** Open an [Issue](https://github.com/vinoth2vinoth/DocArchitect/issues).
- **Want to contribute?** We love PRs! Check our contribution guidelines.

**Developed with ❤️ for the Open Source community.** 

---
*Keywords: AI Documentation Generator, Auto-generate technical docs, Code to Markdown AI, DeepSeek Documentation Sync, Architecture-aware AI, Technical Writing AI, Developer Workflow Automation.*
