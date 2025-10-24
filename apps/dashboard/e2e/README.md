# E2E Tests for Generation Workflow

This directory contains end-to-end tests for the Scrimspec generation workflow.

## Tests Included

### `generation.test.ts`

Comprehensive E2E test suite that validates:

1. **API Response Structure** - Validates the generation status API returns correct fields
2. **Create Short** - Tests creating a new short from a template
3. **Short Status** - Verifies short is created with correct status
4. **Assets** - Confirms assets are created for the short
5. **Generation Queue** - Validates generation jobs are queued
6. **Generation Progress** - Monitors generation progress (if worker is running)

## Prerequisites

1. **Dashboard App Running**
   ```bash
   npm run dev
   ```
   This starts the dashboard on http://localhost:3000 (default)

2. **Database Configured**
   - PostgreSQL with Supabase setup
   - Generation pipeline tables (`generation_shorts`, `generation_assets`, `generation_queue`)

3. **Optional: Generation Worker Running** (for progress tests)
   ```bash
   npm run worker  # from orchestrator package
   ```

## Running Tests

### Run all E2E tests
```bash
npm test -- generation.test.ts
```

### Run with custom base URL
```bash
BASE_URL=http://localhost:3001 npm test -- generation.test.ts
```

### Run in watch mode
```bash
npm test -- generation.test.ts --watch
```

## Test Scenarios

### Scenario 1: Quick Validation
Run the tests to ensure the API is responding correctly and shorts can be created.

```bash
BASE_URL=http://localhost:3000 npm test -- generation.test.ts
```

This takes ~5 seconds and validates:
- API endpoints are working
- Database operations succeed
- Response structures are correct

### Scenario 2: Full Workflow with Worker
Run generation worker first, then run tests:

```bash
# Terminal 1: Start dashboard
npm run dev

# Terminal 2: Start generation worker
cd packages/orchestrator
npm run worker

# Terminal 3: Run tests
npm test -- generation.test.ts
```

This validates the complete flow including:
- Asset generation
- Worker processing
- Storage integration (if Supabase is configured)

## Expected Results

### Without Worker Running
```
✅ Test 1: Create Short from Template
✅ Test 2: Verify Short Status
✅ Test 3: Verify Assets
✅ Test 4: Verify Generation Queue
⚠️  Test 5: Monitor Generation Progress
   No assets were generated (expected - worker not running)
✅ Test 6: Verify API Response Structure

📊 Test Summary
   ✅ Passed: 5-6
   ❌ Failed: 0
```

### With Worker Running
```
✅ Test 1: Create Short from Template
✅ Test 2: Verify Short Status
✅ Test 3: Verify Assets
✅ Test 4: Verify Generation Queue
✅ Test 5: Monitor Generation Progress
   Generation in progress!
✅ Test 6: Verify API Response Structure

📊 Test Summary
   ✅ Passed: 6
   ❌ Failed: 0
```

## Troubleshooting

### Connection Refused
```
Error: ECONNREFUSED 127.0.0.1:3000
```

**Solution:** Make sure the dashboard is running:
```bash
npm run dev
```

### API Error: 500
```
Error: API Error: 500 - Unknown error
```

**Solution:** Check dashboard logs for database connection issues. Ensure:
- `DATABASE_URL` is set
- PostgreSQL is running
- Tables are created

### Test Timeout
If tests take too long or timeout, check:
1. Database performance
2. Network connectivity
3. Generation worker performance (if running)

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run dev &
      - run: sleep 10  # Wait for app to start
      - run: npm test -- generation.test.ts
```

## Extending Tests

To add new tests, follow the pattern:

```typescript
async function testNewFeature(): Promise<void> {
  console.log('\n🆕 Test Name');

  try {
    // Your test logic
    const result = await apiCall('/generation/status');

    // Assertions
    if (!result.ok) {
      throw new Error('Assertion failed');
    }

    console.log(`   ✅ Feature works`);
  } catch (error) {
    console.error(`   ❌ Feature test failed:`, error);
    throw error;
  }
}
```

Then add to the `tests` array in `runTests()`.

## Performance Metrics

Typical test execution times:

- **Test 1** (API Structure): ~100ms
- **Test 2** (Create Short): ~200ms
- **Test 3** (Short Status): ~50ms
- **Test 4** (Assets): ~50ms
- **Test 5** (Queue): ~50ms
- **Test 6** (Progress): 2-10s (depends on retries)

**Total:** ~2.5-11 seconds

## Notes

- Tests are sequential to maintain test data integrity
- Each test can run independently if `ctx.shortId` is provided
- Tests clean up after themselves (no permanent test data)
- Supports multiple parallel test runs (each creates unique template ID)
