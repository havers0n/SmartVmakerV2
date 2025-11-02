# Contributing to Scrimspec

Thank you for your interest in contributing to Scrimspec! This guide will help you get started with development, testing, and best practices.

## Table of Contents

- [Development Setup](#development-setup)
- [Testing](#testing)
  - [Running Tests](#running-tests)
  - [Writing Tests](#writing-tests)
  - [Database Mocking](#database-mocking)
- [Code Quality](#code-quality)
- [Git Workflow](#git-workflow)

## Development Setup

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 7.33.7 or higher
- **PostgreSQL** (for local development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd scrimspec

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Running the Application

```bash
# Start dashboard in development mode
pnpm --filter dashboard dev

# Start workers
pnpm --filter @scrimspec/workers dev:ingest
pnpm --filter @scrimspec/workers dev:enrich
pnpm --filter @scrimspec/workers dev:analysis
```

## Testing

We use **Vitest** for unit testing across the project. Tests ensure code reliability and provide a safety net for refactoring.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter dashboard test
pnpm --filter @scrimspec/workers test

# Run tests in watch mode (re-runs on file changes)
pnpm --filter dashboard test:watch

# Run tests with UI
pnpm --filter dashboard test:ui

# Run specific test file
pnpm --filter dashboard test src/app/api/actions/handlers/ingest.test.ts
```

### Writing Tests

#### File Structure

Place test files next to the code they test, using the `.test.ts` extension:

```
src/
  app/
    api/
      actions/
        handlers/
          ingest.ts
          ingest.test.ts       ← Test file
          analysis.ts
          analysis.test.ts     ← Test file
```

#### Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { functionToTest } from './module';

describe('functionToTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test data';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Database Mocking

We use **vi.mock()** from Vitest to mock database operations. This allows tests to run without a real database connection.

#### Example: Mocking Database Client

```typescript
import { vi } from 'vitest';

// Mock the database module
vi.mock('@/shared/lib/db', () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };

  return {
    db: mockDb,
    ingestJobQueue: {},
  };
});
```

#### Using Test Utilities

We provide pre-built utilities for common mocking scenarios in `src/test/mocks/db.ts`:

```typescript
import { createMockDb, createMockIngestJob } from '@/test/mocks/db';

describe('MyHandler', () => {
  it('should create a job', async () => {
    // Create a mock database
    const mockDb = createMockDb();

    // Create mock data
    const mockJob = createMockIngestJob({
      id: 123,
      query: 'test query',
    });

    // Setup mock behavior
    mockDb.returning.mockResolvedValue([mockJob]);

    // Run your test...
  });
});
```

#### Complete Example: Testing an Action Handler

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startSearch } from './ingest';

// Mock dependencies
vi.mock('@/shared/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
  ingestJobQueue: {},
}));

vi.mock('@aec/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('startSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should accept valid payload', async () => {
      const { db } = await import('@/shared/lib/db');
      const mockJob = { id: 1, status: 'pending' };

      (db.returning as any).mockResolvedValue([mockJob]);

      const payload = {
        query: 'test query',
        maxResults: 25,
      };

      const result = await startSearch(payload);

      expect(result.jobId).toBe(1);
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          maxResults: 25,
        })
      );
    });

    it('should reject invalid query', async () => {
      const payload = {
        query: 'ab', // Too short (min 3 characters)
      };

      await expect(startSearch(payload)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should propagate database errors', async () => {
      const { db } = await import('@/shared/lib/db');

      (db.returning as any).mockRejectedValue(
        new Error('Database error')
      );

      const payload = { query: 'test' };

      await expect(startSearch(payload)).rejects.toThrow('Database error');
    });
  });
});
```

### Testing Best Practices

1. **Arrange-Act-Assert Pattern**: Structure tests clearly
2. **Test Behavior, Not Implementation**: Focus on what the code does, not how
3. **Clear Test Names**: Use descriptive names that explain what's being tested
4. **Mock External Dependencies**: Database, APIs, file system, etc.
5. **Test Edge Cases**: Empty inputs, null values, boundary conditions
6. **Test Error Paths**: Ensure errors are handled gracefully
7. **Clean Up**: Use `beforeEach` to reset mocks between tests

### Code Coverage

Generate code coverage reports:

```bash
pnpm --filter dashboard test --coverage
```

Coverage reports will be generated in the `coverage/` directory.

## Code Quality

### Type Checking

```bash
# Check types across all packages
pnpm type-check

# Check types for specific package
pnpm --filter dashboard type-check
pnpm --filter @scrimspec/workers type-check
```

### Linting

```bash
# Lint code
pnpm --filter dashboard lint

# Auto-fix lint issues
pnpm --filter dashboard lint --fix
```

### Formatting

```bash
# Check code formatting
pnpm --filter dashboard format:check

# Auto-format code
pnpm --filter dashboard format
```

## Git Workflow

### Branches

- `main` - Production-ready code
- `feat/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code refactoring
- `test/*` - Test additions/improvements

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `docs`: Documentation changes
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(ingest): add retry mechanism for YouTube API calls"
git commit -m "test(analysis): add unit tests for analysis action handler"
git commit -m "fix(enrichment): handle null duration values"
```

### Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feat/my-new-feature
   ```

2. **Write Tests First** (TDD approach recommended)
   - Write failing tests for new functionality
   - Implement the feature
   - Ensure all tests pass

3. **Run Quality Checks**
   ```bash
   pnpm test
   pnpm type-check
   pnpm --filter dashboard lint
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feat/my-new-feature
   ```

## Questions?

If you have questions or need help:
- Check existing documentation in `docs/`
- Review test examples in `src/**/*.test.ts`
- Ask in project discussions or issues

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

Thank you for contributing to Scrimspec! 🚀
