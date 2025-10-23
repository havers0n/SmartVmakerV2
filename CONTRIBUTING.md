# Contributing to Scrimspec

Thank you for your interest in contributing! This guide will help you understand our development workflow and standards.

## 🚀 Quick Start

### 1. Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/scrimspec.git
cd scrimspec

# Install dependencies
pnpm install

# Verify setup
pnpm type-check && pnpm build
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-fix-name
```

### 3. Make Changes

Edit files in your feature branch. Keep commits focused and atomic:

```bash
git add .
git commit -m "feat: add awesome feature"
```

**Commit Message Format:** `[type]: [description]`

Types:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `style:` — Code style (formatting, etc)
- `refactor:` — Code refactoring
- `perf:` — Performance improvement
- `test:` — Tests
- `chore:` — Maintenance

### 4. Local Checks Before Pushing

```bash
# Format code
pnpm format

# Lint
pnpm lint

# Type-check
pnpm type-check

# Build
pnpm build

# Run tests (if applicable)
pnpm test
```

### 5. Push & Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 📋 Code Standards

### TypeScript

- ✅ **Strict mode enabled** — `"strict": true` in tsconfig
- ✅ **No `any` types** — Use proper interfaces
- ✅ **Types first** — Define interfaces before implementation
- ✅ **Reuse shared types** — Import from `@scrimspec/shared-types`

**Example:**
```typescript
import type { Task, TextToVideoRequest } from '@scrimspec/shared-types';

export async function createTask(data: TextToVideoRequest): Promise<Task> {
  // Implementation
}
```

### Error Handling

- ✅ **Always use try-catch** in async functions
- ✅ **Log errors** with logger.error()
- ✅ **Provide meaningful messages** for debugging
- ✅ **Use custom error classes** (AppError, etc)

**Example:**
```typescript
try {
  const result = await hailuoPOST('/api/endpoint', body);
  return result;
} catch (error) {
  logger.error(
    { error: error instanceof Error ? error.message : String(error) },
    'Failed to call API'
  );
  throw error;
}
```

### Code Organization

- ✅ **Single Responsibility** — Each file does one thing
- ✅ **Meaningful Names** — Use clear, descriptive names
- ✅ **Comments** — Document non-obvious logic
- ✅ **Keep Files Small** — Aim for <200 lines per file

**Directory Structure:**
```
packages/
├── orchestrator/src/
│   ├── services/      ← Business logic
│   ├── routes/        ← API endpoints
│   ├── middleware/    ← Middleware
│   ├── db/            ← Database layer
│   └── lib/           ← Utilities
```

### Formatting

We use **Prettier** for automatic formatting:

```bash
pnpm format
```

**Key rules:**
- 80 character line length
- 2 spaces indentation
- Single quotes for strings
- Trailing commas in multi-line objects

## 🧪 Testing

### Writing Tests

Create test files alongside source code:

```
src/services/
├── videoService.ts
└── __tests__/
    └── videoService.test.ts
```

**Test Structure:**
```typescript
import { describe, it, expect } from 'jest';
import { createTextToVideo } from '../videoService';

describe('videoService', () => {
  it('should create T2V task', async () => {
    const result = await createTextToVideo({
      prompt: 'A cat',
      duration: 6,
    });

    expect(result).toHaveProperty('task_id');
    expect(result.status_code).toBe(0);
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test -- --watch

# Specific file
pnpm test -- path/to/test.test.ts

# Coverage
pnpm test -- --coverage
```

## 📚 Documentation

Every significant feature should include documentation:

### Code Comments
```typescript
/**
 * Create a Text-to-Video task
 * @param request - Video generation request
 * @returns Promise with task_id
 */
export async function createTextToVideo(request: TextToVideoRequest) {
  // ...
}
```

### Inline Comments (for complex logic)
```typescript
// Cache the result to avoid duplicate API calls
jobs.set(taskId, taskData);
```

### README Updates
Update relevant `README.md` files when:
- Adding new endpoints
- Changing environment variables
- Adding new dependencies

## 🔍 PR Review Checklist

Before submitting a PR, ensure:

- [ ] Code formatted with `pnpm format`
- [ ] Linting passes: `pnpm lint`
- [ ] Type-checking passes: `pnpm type-check`
- [ ] Build succeeds: `pnpm build`
- [ ] Tests pass (if applicable): `pnpm test`
- [ ] No console.log statements (use logger)
- [ ] No `any` types used
- [ ] PR title follows conventional commits
- [ ] PR description explains the change
- [ ] Related issues are linked (`Closes #123`)
- [ ] Documentation updated (if applicable)

## 🏗️ Architecture Decisions

Before making significant architectural changes:

1. **Create an issue** discussing the change
2. **Get consensus** from maintainers
3. **Document the decision** in `ARCHITECTURE.md`
4. **Update affected code** systematically

## 🔄 Monorepo Workflow

Working with multiple packages:

```bash
# Install dependencies for all packages
pnpm install

# Build all packages
pnpm build

# Build specific package
pnpm --filter @scrimspec/orchestrator build

# Format code in all packages
pnpm format

# Lint in specific package
pnpm --filter @scrimspec/db lint
```

## 📦 Adding Dependencies

Only add dependencies that are necessary:

```bash
# Add to specific package
pnpm add --filter @scrimspec/orchestrator new-package

# Add dev dependency
pnpm add -D --filter @scrimspec/orchestrator dev-package
```

Then:
1. Update `package.json` in the package
2. Update documentation if needed
3. Commit both `package.json` and `pnpm-lock.yaml`

## 🚀 Deployment Notes

> This section is for future deployment processes

For now, deployment is manual. When automated deployment is set up:

1. PR to `main` branch
2. CI passes all checks
3. Maintainer approves & merges
4. GitHub Actions deploys automatically

## 🎯 Common Tasks

### Adding a New API Endpoint

1. Define types in `@scrimspec/shared-types`
2. Create service function in `services/`
3. Create route handler in `routes/`
4. Add route to `routes/index.ts`
5. Update documentation
6. Test with API client

### Fixing a Bug

1. Create issue with reproduction steps
2. Create branch: `git checkout -b fix/bug-description`
3. Fix the bug
4. Add test to prevent regression
5. Submit PR with `Closes #issue-number`

### Refactoring Code

1. Ensure existing tests pass
2. Make changes
3. Run `pnpm type-check` and `pnpm lint`
4. Update tests if needed
5. Verify no regressions with `pnpm test`

## ❓ Questions?

- 📖 Check `ARCHITECTURE.md` for architecture questions
- 🚀 Check `.github/CI_CD_GUIDE.md` for CI/CD questions
- 🔧 Check package READMEs for package-specific info
- 💬 Open an issue to discuss

## 📝 License

By contributing to Scrimspec, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** 🎉

Your efforts help make Scrimspec better for everyone.

---

**Last updated:** October 23, 2025
