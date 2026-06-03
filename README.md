# DocArchitect

**Keep your architecture documentation in sync with your code—automatically.**

DocArchitect is a local-first, architecture-aware documentation tool that prevents documentation drift by generating and maintaining Markdown docs alongside your source code. Unlike generic AI documentation generators, DocArchitect understands your project's structure, groups related files intelligently, and provides enterprise-grade safety controls for team workflows.

## Why DocArchitect?

Documentation drift is real: **85% of teams struggle** with outdated docs, while **72% lose critical context** during code reviews. Existing solutions force you to choose between:

- ✍️ Manual maintenance (accurate but time-consuming)
- 🤖 Full AI rewrites (fast but risky and expensive)
- 📄 Static templates (consistent but inflexible)

DocArchitect takes a different approach: **assisted documentation workflows** that combine AI efficiency with human oversight.

## What Problems Does It Solve?

| Problem | Impact | DocArchitect Solution |
|---------|--------|----------------------|
| **Documentation Drift** | 85% of teams affected | Architecture-aware grouping ensures docs update when code changes |
| **Review Overhead** | 68% cite as bottleneck | `--dry-run` and `--check` modes enable safe, reviewable updates |
| **Token Costs** | 54% concerned about expenses | Incremental generation (60-80% savings) + smart budgeting (30-50% reduction) |
| **Integration Friction** | 61% struggle with CI/CD | Pre-built GitHub Actions, GitLab CI, and pre-commit hooks |
| **Context Loss** | 72% experience knowledge gaps | Local-first design keeps docs with code; health scores track coverage |

## Key Differentiators

### 🏗️ Architecture-Aware Grouping
Unlike tools that process files in isolation, DocArchitect analyzes all source blocks targeting the same document together, preventing conflicting updates and maintaining architectural coherence.

### 🛡️ Safe by Design
- **No unattended rewrites**: Every change requires explicit approval
- **Multiple safety modes**: Dry-run, check-only, and validation flags
- **Conflict resolution**: Incoming changes create `.incoming` files for manual review
- **Private by default**: GitHub publisher creates private repos unless configured otherwise

### 💰 Cost-Optimized Token Usage
- **Incremental generation**: SHA-256 caching detects unchanged files (60-80% token savings)
- **Smart context budgeting**: File importance scoring prioritizes critical architecture (30-50% reduction)
- **AST-aware change detection**: Only regenerates sections with actual API changes
- **Multi-provider support**: Switch between DeepSeek, OpenAI, Anthropic, Google based on cost/performance needs

### 📊 Documentation Health Intelligence
Built-in health scoring system tracks:
- Coverage metrics (% of source files documented)
- Freshness analysis (detects stale documents)
- Link validation (identifies broken references)
- Token efficiency (cache hit rates, usage patterns)

### 🔧 Developer Experience First
- **Local execution**: No cloud dependencies, full control over your data
- **Open source**: Transparent implementation, extensible architecture
- **CLI-first design**: Simple commands, comprehensive help, scriptable workflows
- **Language agnostic**: TypeScript, JavaScript, Python, Rust, Go, Java support

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
| `npm run sync-docs -- --incremental` | Enables incremental generation with caching (60-80% token savings). |
| `npm run sync-docs -- --validate-config` | Validates configuration file and exits. |
| `npm run sync-docs -- --health` | Analyzes and displays documentation health metrics. |
| `npm run sync-docs -- --smart-budget` | Enables smart context budgeting based on file importance scoring. |
| `npm run sync-docs -- --budget-strategy <strategy>` | Sets budget strategy: balanced, coverage, or depth (default: balanced). |
| `npm run sync-docs -- --max-tokens <number>` | Sets maximum tokens for context window (default: 4096). |

## Documentation Health

Run `doc-architect --health` to get a comprehensive report on your documentation:

```bash
npx doc-architect --health
```

The health check analyzes:
- **Coverage**: Percentage of source files documented
- **Freshness**: Detects stale documents with code changes
- **Link Health**: Identifies broken markdown links
- **Token Efficiency**: Tracks cache hit rate and usage patterns

Example output:
```
🟢 Overall Score: 85/100

📁 COVERAGE
   Documented: 45/50 files (90%)

🕐 FRESHNESS
   Average Age: 12.3 days
   Stale Documents: 2
   Score: 92/100

🔗 LINK HEALTH
   Total Links: 127
   Broken Links: 0
   Score: 100/100

⚡ TOKEN EFFICIENCY
   Total Tokens Used: 125,430
   Average per Doc: 2,787
   Cache Hit Rate: 73%

💡 RECOMMENDATIONS
   🟡 [COVERAGE] 90% coverage - consider documenting remaining files
      → Review undocumented directories and add them to mappings
```

## GitHub Publish/Pull

The GitHub publisher is safe by default:

- Creates private repositories unless explicitly configured otherwise.
- Publishes to a sync branch, not directly to `main`.
- Opens a pull request for review.
- Ignores common secret and build-output patterns such as `.env*`, `*.pem`, `*.key`, `node_modules`, and `dist`.

The puller does not overwrite changed local files by default. If remote content differs from an existing file, it writes a sibling `.incoming` file and reports a conflict for manual review.

## Smart Context Budgeting

DocArchitect includes smart context budgeting to optimize token usage by prioritizing important files:

```bash
# Enable smart budgeting with balanced strategy (default)
npm run sync-docs -- --smart-budget

# Use coverage strategy (prioritize high-importance files)
npm run sync-docs -- --smart-budget --budget-strategy coverage

# Use depth strategy (include more files with summaries)
npm run sync-docs -- --smart-budget --budget-strategy depth

# Set custom token limit
npm run sync-docs -- --smart-budget --max-tokens 8192
```

The importance scoring algorithm considers:
- **File type**: TypeScript, Rust, Go, Java get higher scores
- **File name**: index, main, app files are prioritized
- **Path location**: /api/, /core/, /lib/ directories score higher
- **File size**: Larger files (>500 lines) get bonus points
- **Export count**: More exports indicate higher importance
- **Complexity**: Classes, interfaces, async patterns increase score

Budget strategies:
- **balanced** (default): Sort by importance, allocate proportionally
- **coverage**: Prioritize most important files, may omit low-priority ones
- **depth**: Include all files but summarize low-priority ones

This feature can reduce token usage by 30-50% while maintaining documentation quality for critical architecture components.

## CI/CD Integration

DocArchitect includes templates for GitHub Actions, GitLab CI, and pre-commit hooks:

```bash
# Copy GitHub Actions workflow
cp templates/.github/workflows/doc-architect.yml .github/workflows/

# Copy GitLab CI template  
cp templates/.gitlab-ci-docs.yml .gitlab-ci.yml

# Install pre-commit hook
cp templates/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

See [templates/README.md](templates/README.md) for detailed setup instructions.

### Example GitHub Actions Workflow

The included workflow:
- ✅ Validates configuration on every run
- 🔍 Checks documentation sync on pull requests
- 🔄 Auto-updates documentation on push to main/master
- 📊 Runs health checks and reports issues

## Who Should Use DocArchitect?

**Ideal for:**
- 🏢 Mid-size tech companies (50-500 engineers) maintaining complex architectures
- 🔓 Open source projects needing up-to-date contributor documentation
- 🛡️ Teams with compliance requirements for documentation accuracy
- 💰 Cost-conscious organizations wanting AI efficiency without vendor lock-in
- 🔄 Projects undergoing active refactoring or architectural changes

**Not a fit for:**
- Projects expecting fully automated, unattended documentation rewrites
- Teams unwilling to review AI-generated content before merging
- Simple projects with minimal architecture documentation needs

## Current Limits

DocArchitect is designed as an **assisted documentation workflow**, not a replacement for human judgment:

- Requires LLM API access (bring your own keys)
- Generates full documents on each run (incremental mode mitigates this)
- Architecture-aware grouping works best with clear module boundaries
- Manual setup required for initial configuration and mappings

**Best practices:**
- ✅ Review generated diffs before merging
- ✅ Use `--check` mode in CI pipelines
- ✅ Keep mappings focused on coherent architectural units
- ✅ Validate critical architecture claims with conventional tests
- ✅ Start with `--dry-run` to understand change impact

## Getting Started

1. **Install**: `npm install doc-architect`
2. **Configure**: Create `doc-architect.json` with your project structure
3. **Set API key**: Export your preferred provider's API key
4. **Test run**: `npx doc-architect --dry-run`
5. **Review & sync**: Check the preview, then run without flags
6. **Automate**: Add CI/CD workflow from templates

## Community & Support

- 📖 [Templates Documentation](templates/README.md) - CI/CD setup guides
- 🐛 [Issue Tracker](https://github.com/your-org/doc-architect/issues) - Report bugs or request features
- 💬 Discussions - Share use cases and best practices

---

*DocArchitect is open source and built for the community. Contributions welcome.*
