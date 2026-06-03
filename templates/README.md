# 🚀 Enhanced CI/CD Integration for DocArchitect

This directory contains templates for integrating DocArchitect into your CI/CD pipeline.

## GitHub Actions

### Setup

1. Copy the workflow file to your repository:
   ```bash
   cp templates/.github/workflows/doc-architect.yml .github/workflows/
   ```

2. Add your API key as a secret:
   - Go to Repository Settings → Secrets and variables → Actions
   - Add `DEEPSEEK_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)

3. The workflow will:
   - ✅ Validate configuration on every run
   - 🔍 Check documentation sync on pull requests (fails if out of sync)
   - 🔄 Auto-update documentation on push to main/master
   - 📊 Run health checks and report issues

## GitLab CI

### Setup

1. Include the template in your `.gitlab-ci.yml`:
   ```yaml
   include:
     - local: 'templates/.gitlab-ci-docs.yml'
   ```

2. Add CI/CD variables:
   - Go to Settings → CI/CD → Variables
   - Add `DEEPSEEK_API_KEY` (masked and protected)

3. The pipeline will:
   - Run documentation checks on merge requests
   - Auto-sync on default branch pushes
   - Generate health reports as artifacts

## Pre-commit Hook

### Setup

1. Install the pre-commit hook:
   ```bash
   cp templates/pre-commit .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

2. Or use with husky:
   ```bash
   npx husky add .husky/pre-commit "npx doc-architect --check --incremental"
   ```

3. The hook will:
   - Only run when relevant source files change
   - Block commits if documentation is out of sync
   - Skip automatically if no config found

## Best Practices

### 1. Use Incremental Mode
Always use `--incremental` flag in CI/CD to reduce token usage by 60-80%.

### 2. Separate Check and Update
- **Pull Requests**: Use `--check` to verify sync without modifying files
- **Main Branch**: Allow auto-updates with commit permissions

### 3. Health Monitoring
Run `--health` periodically to track:
- Documentation coverage
- Stale documents
- Broken links
- Token efficiency

### 4. Fail Fast
Configure CI to fail on:
- Configuration validation errors
- Documentation drift in PRs
- Critical health issues (optional)

## Environment Variables

Supported providers (in order of precedence):
1. Config file `apiKey` field
2. `DEEPSEEK_API_KEY`
3. `OPENAI_API_KEY`
4. `ANTHROPIC_API_KEY`
5. `GOOGLE_GENERATIVE_AI_API_KEY`

## Customization

### Skip Certain Paths
Modify the workflow triggers:
```yaml
paths:
  - 'src/**'
  - '!src/vendor/**'  # Exclude vendor directory
```

### Custom Commit Message
Update the git commit step:
```bash
git commit -m "docs: sync with latest code changes [auto]"
```

### Notification Integration
Add Slack/Discord notifications:
```yaml
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Documentation sync failed!",
        "blocks": [...]
      }
```

## Troubleshooting

### Workflow Not Triggering
- Verify paths match your project structure
- Check branch names in workflow filters
- Ensure secrets are properly configured

### High Token Usage
- Enable `--incremental` mode
- Split large documentation files
- Review context budget settings

### Permission Issues
- Ensure workflow has write permissions
- Configure branch protection rules appropriately
- Use deploy keys for private repositories

## Support

For issues or feature requests, please open an issue on the DocArchitect repository.
