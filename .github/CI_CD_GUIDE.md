# CI/CD Guide - GitHub Actions

This document describes the Continuous Integration and Deployment setup for Scrimspec.

## Overview

Scrimspec uses **GitHub Actions** for automated quality assurance:

```
On Push/PR to main/develop
    ↓
[Setup] Install dependencies & cache pnpm
    ↓
[Parallel Jobs]
├─ [Lint] ESLint (code quality)
├─ [Type-Check] TypeScript (type safety)
├─ [Format-Check] Prettier (code style)
└─ [Test] Jest (unit & integration tests)
    ↓
[Build] TypeScript compilation (all packages)
    ↓
[Summary] Report overall CI status
```

## Workflows

### 1. **ci.yml** - Main CI Pipeline
**Trigger:** Push to `main`/`develop`, Pull Requests

**Jobs (in order):**
1. **Setup** - Install dependencies with pnpm cache
2. **Lint** - ESLint check on `src/`
3. **Type-Check** - TypeScript strict mode validation
4. **Build** - Compile all packages with `tsc`
5. **Summary** - Report final CI status

**Time:** ~3-5 minutes

**Artifacts:**
- `build-artifacts/` — Compiled `.js` files and `.d.ts` types

### 2. **format-check.yml** - Code Format Validation
**Trigger:** Push to `main`/`develop`, Pull Requests

**Job:**
- **Format-Check** - Verify Prettier formatting

**Time:** ~1 minute

**Fix locally:**
```bash
pnpm format
```

### 3. **test.yml** - Test Suite
**Trigger:** Push to `main`/`develop`, Pull Requests

**Job:**
- **Test** - Run Jest tests (all packages)
- **Coverage Report** - Upload to artifacts & PR comment

**Time:** ~2-3 minutes

**Artifacts:**
- `coverage-reports/` — Test coverage data

**Run locally:**
```bash
pnpm test
```

## Running Locally

Before pushing, always run local checks:

```bash
# 1. Format code
pnpm format

# 2. Lint
pnpm lint

# 3. Type-check
pnpm type-check

# 4. Build
pnpm build

# 5. Test (optional)
pnpm test
```

**Or all at once:**
```bash
pnpm format && pnpm lint && pnpm type-check && pnpm build
```

## Workflow Files Structure

```
.github/
└── workflows/
    ├── ci.yml               ← Main CI pipeline (lint, type-check, build)
    ├── format-check.yml     ← Prettier validation
    ├── test.yml             ← Jest tests + coverage
    └── CI_CD_GUIDE.md       ← This file
```

## Package Scripts

Each package must provide these scripts:

```json
{
  "scripts": {
    "build": "tsc",                        # Compile TypeScript
    "lint": "eslint src",                  # Check code quality
    "format": "prettier -w src",           # Format code
    "format:check": "prettier --check src", # Verify formatting
    "type-check": "tsc --noEmit",          # Type validation
    "test": "jest",                        # Run tests
    "clean": "rm -rf dist"                 # Clean build
  }
}
```

### Monorepo Scripts (Root)

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "format": "turbo run format",
    "format:check": "turbo run format:check",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
```

## Caching Strategy

### pnpm Cache
- **Key:** `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`
- **Path:** `~/.pnpm-store`
- **TTL:** 5 days (default)

**Benefits:**
- ✅ 60-70% faster CI runs (cached dependencies)
- ✅ Reduced network traffic
- ✅ Better reliability

### Build Artifacts
- **Retention:** 7 days
- **Contents:** `dist/`, `out/`, `.next/`

**Benefits:**
- ✅ Reusable across jobs
- ✅ Can be deployed without rebuild
- ✅ Debugging aid

## PR Checks

When you open a Pull Request, GitHub will automatically:

1. ✅ Run all CI workflows
2. 📊 Report results as PR checks
3. 💬 Comment with test coverage (if applicable)
4. 🚫 Block merging if any check fails

**PR Status Examples:**

```
✅ CI / Lint (success)
✅ CI / Type-Check (success)
✅ CI / Build (success)
✅ Format Check / Format-Check (success)
✅ Test / Test (success)
```

**If any fail:**
```
❌ CI / Lint (failure)
  See logs for details: https://github.com/...
```

## Fixing CI Failures

### Lint Failure
```bash
# Fix ESLint issues
pnpm lint --fix

# Or manually review and fix
pnpm lint
```

### Type-Check Failure
```bash
# Review TypeScript errors
pnpm type-check

# Fix in your editor (ESLint/Prettier recommended)
```

### Format Failure
```bash
# Auto-fix formatting
pnpm format
```

### Build Failure
```bash
# Rebuild locally
pnpm clean
pnpm build

# Check for missing dependencies
pnpm install

# Check for type errors
pnpm type-check
```

### Test Failure
```bash
# Run tests locally
pnpm test

# Run specific test file
pnpm test -- path/to/test.test.ts

# Debug with verbose output
pnpm test -- --verbose
```

## Secrets & Env Variables

⚠️ **No secrets should be in workflows!**

For deployment workflows (future), use GitHub Secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `DEPLOY_TOKEN` — Deployment authentication
   - `DATABASE_URL` — Database connection (staging/prod)
   - etc.

**Usage in workflows:**
```yaml
- name: Deploy
  env:
    DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
  run: ./deploy.sh
```

## Performance Optimization

### Current Performance
- **Setup:** ~30 seconds (pnpm install)
- **Lint:** ~45 seconds
- **Type-Check:** ~40 seconds
- **Build:** ~1-2 minutes
- **Total:** ~3-5 minutes

### Future Improvements
1. **Incremental Builds** — Only rebuild changed packages
2. **Matrix Testing** — Test on multiple Node versions
3. **Artifact Caching** — Cache dist/ between runs
4. **Concurrent Jobs** — Run more jobs in parallel
5. **Split Long Workflows** — Separate fast checks from slow builds

## Debugging CI Failures

### View Logs
1. Go to **Actions** tab
2. Click the failed workflow run
3. Expand the failed job
4. Check the logs for errors

### Common Issues

**`node_modules` not found:**
```
→ Ensure pnpm-lock.yaml is committed
→ Run `pnpm install --frozen-lockfile` locally
```

**`TypeScript` compilation errors:**
```
→ Run `pnpm type-check` locally
→ Check tsconfig.json
→ Verify all imports are correct
```

**`ESLint` configuration issues:**
```
→ Check eslint.config.js
→ Run `pnpm lint --fix` locally
→ Review .eslintignore
```

**`Build` artifacts missing:**
```
→ Ensure dist/ is generated
→ Check tsconfig.json compilerOptions
→ Verify build script in package.json
```

## Workflow Maintenance

### Updating Node Version
1. Edit `.github/workflows/ci.yml`
2. Change `NODE_VERSION: '20'` to desired version
3. Test locally with that version
4. Commit and push

### Updating pnpm Version
1. Edit `.github/workflows/ci.yml`
2. Change `PNPM_VERSION: '8'` to desired version
3. Update root `package.json` `engines.pnpm`
4. Update `.npmrc` if needed
5. Test locally with that version

### Adding New Workflows
1. Create `.github/workflows/new-workflow.yml`
2. Use existing workflows as templates
3. Test with GitHub Actions syntax validator
4. Document in this guide

## Useful GitHub Actions

### For Future Enhancement
- **codecov/codecov-action** — Upload coverage reports
- **github-script** — Run JavaScript in workflows
- **actions/cache** — Advanced caching
- **docker/build-push-action** — Docker builds
- **actions/deploy-pages** — Deploy to GitHub Pages

## FAQ

**Q: CI is slow, can I speed it up?**

A: Yes! Use Turbo's remote caching:
```yaml
- name: Build with Turbo Cache
  run: pnpm build -- --remote-only
```

**Q: Can I skip CI for a commit?**

A: Yes, use `[skip ci]` in commit message:
```bash
git commit -m "docs: update README [skip ci]"
```

**Q: How do I test a workflow change locally?**

A: Use [act](https://github.com/nektos/act):
```bash
act push -j ci
```

**Q: What if I need to deploy from CI?**

A: Create a new workflow (e.g., `deploy.yml`):
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: ./scripts/deploy.sh
```

## Support

For issues with CI/CD:
1. Check workflow logs in **Actions** tab
2. Run commands locally to reproduce
3. Review this guide
4. Check GitHub Actions documentation
5. Create an issue with logs

---

**Last updated:** October 23, 2025
**Status:** Active ✅
**Node Version:** 20 LTS
**pnpm Version:** 8+
