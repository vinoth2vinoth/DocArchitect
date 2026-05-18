# DocArchitect 🏗️

**Documentation as Architecture.** 

DocArchitect is an AI-powered CLI tool designed to keep your technical documentation perfectly synchronized with your source code. It treats your codebase as the source of truth and uses DeepSeek's advanced reasoning to update your markdown files whenever your architecture evolves.

## Features

- **Language Agnostic**: Support for TypeScript, Python, Go, Rust, Java, and more out of the box.
- **Architecture-Aware**: Understands relationships between files, not just individual summaries.
- **DeepSeek Integration**: Optimized for the latest DeepSeek models for high accuracy and lower cost.
- **Dynamic Updates**: Automatically adds new features and removes deprecated sections in your docs.
- **CI/CD Ready**: Integrated easily with GitHub Actions (included).
- **Minimalistic & Sharp**: Generates documentation that reads like code—technical, dense, and meaningful.

## Installation

```bash
npm install -g doc-architect
```

## Setup

1. Create a `doc-architect.json` at your project root:

```json
{
  "sourceRoot": "./src",
  "docsRoot": "./docs",
  "include": ["**/*.py", "**/*.go"],
  "mappings": {
    "core": "core-logic.md",
    "api": "api-reference.md"
  }
}
```

2. Set your API key:
```bash
export DEEPSEEK_API_KEY=your_key_here
```

3. Run the sync:
```bash
doc-architect
```

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
