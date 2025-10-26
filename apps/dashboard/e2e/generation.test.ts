/**
 * E2E Tests for Generation Workflow
 *
 * This test suite validates the complete generation workflow:
 * 1. Create a short from a template
 * 2. Verify assets are enqueued for generation
 * 3. Check job queue status
 * 4. Verify worker processing (via API status endpoint)
 *
 * Prerequisites:
 * - Dashboard app is running on http://localhost:3000
 * - Database is configured with generation_pipeline tables
 * - MiniMax/Hailuo APIs are mocked or available
 *
 * Run with: npm test -- generation.test.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TestContext {
  shortId?: string;
  assetCount?: number;
  templateId: string;
  provider: 'minimax' | 'hailuo';
}

const ctx: TestContext = {
  templateId: `test-template-${Date.now()}`,
  provider: 'minimax',
};

/**
 * Helper to make API calls
 */
async function apiCall(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const url = `${BASE_URL}/api${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${data.error || 'Unknown error'}`);
  }

  return data;
}

/**
 * Test 1: Create a short from template
 */
async function testCreateShort(): Promise<void> {
  console.log('\n📋 Test 1: Create Short from Template');
  console.log(`   Template ID: ${ctx.templateId}`);
  console.log(`   Provider: ${ctx.provider}`);

  try {
    const result = await apiCall('/generation/shorts', {
      method: 'POST',
      body: JSON.stringify({
        templateId: ctx.templateId,
        provider: ctx.provider,
      }),
    });

    if (!result.ok) {
      throw new Error('API response not ok');
    }

    ctx.shortId = result.shortId;
    ctx.assetCount = result.enqueued;

    console.log(`   ✅ Short created: ${ctx.shortId}`);
    console.log(`   ✅ Assets enqueued: ${ctx.assetCount}`);

    if (!ctx.shortId) {
      throw new Error('No shortId returned');
    }

    if (!ctx.assetCount || ctx.assetCount === 0) {
      throw new Error('No assets were enqueued');
    }
  } catch (error) {
    console.error(`   ❌ Failed to create short:`, error);
    throw error;
  }
}

/**
 * Test 2: Verify short is in pending status
 */
async function testShortStatus(): Promise<void> {
  console.log('\n📊 Test 2: Verify Short Status');

  if (!ctx.shortId) {
    throw new Error('No shortId available - run testCreateShort first');
  }

  try {
    // Get all projects and find the one we created
    const result = await apiCall(`/generation/shorts`);

    if (!result.ok) {
      throw new Error('Failed to get shorts');
    }

    const short = result.shorts.find((s: any) => s.id === ctx.shortId);

    if (!short) {
      throw new Error('Short not found in response');
    }

    console.log(`   ✅ Short found: ${short.id}`);
    console.log(`   ✅ Status: ${short.status}`);
    console.log(`   ✅ Assets: ${short.assetCount}`);

    if (short.status !== 'pending' && short.status !== 'processing') {
      throw new Error(`Unexpected short status: ${short.status}`);
    }
  } catch (error) {
    console.error(`   ❌ Failed to verify short status:`, error);
    throw error;
  }
}

/**
 * Test 3: Verify generation status endpoint
 */
async function testGenerationStatus(): Promise<void> {
  console.log('\n📊 Test 3: Verify Generation Status Endpoint');

  try {
    const result = await apiCall(`/generation/status`);

    if (!result.ok) {
      throw new Error('Failed to get generation status');
    }

    console.log(`   ✅ Projects found: ${result.count}`);
    console.log(`   ✅ Job queue stats: ${result.jobQueueStats.length} statuses`);

    // Verify structure
    if (!Array.isArray(result.projects)) {
      throw new Error('projects is not an array');
    }

    if (!Array.isArray(result.jobQueueStats)) {
      throw new Error('jobQueueStats is not an array');
    }

  } catch (error) {
    console.error(`   ❌ Failed to verify generation status:`, error);
    throw error;
  }
}

/**
 * Test 4: Verify API response structure
 */
async function testAPIResponseStructure(): Promise<void> {
  console.log('\n📐 Test 4: Verify API Response Structure');

  try {
    const result = await apiCall('/generation/status');

    if (!result.ok) {
      throw new Error('API response not ok');
    }

    // Verify required fields
    const requiredFields = ['projects', 'jobQueueStats', 'count'];

    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
      console.log(`   ✅ Field '${field}' present`);
    }

    // Verify array types
    if (!Array.isArray(result.projects)) {
      throw new Error('projects is not an array');
    }
    if (!Array.isArray(result.jobQueueStats)) {
      throw new Error('jobQueueStats is not an array');
    }

    console.log(`   ✅ All fields have correct types`);

  } catch (error) {
    console.error(`   ❌ API response structure test failed:`, error);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  console.log('🚀 Starting E2E Generation Tests');
  console.log(`   Base URL: ${BASE_URL}`);

  const tests = [
    { name: 'API Response Structure', fn: testAPIResponseStructure },
    { name: 'Create Short', fn: testCreateShort },
    { name: 'Short Status', fn: testShortStatus },
    { name: 'Generation Status', fn: testGenerationStatus },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      console.error(`\n❌ Test failed: ${test.name}`);
      console.error(error);
      failed++;

      // Don't stop on first failure, continue with remaining tests
      if (test.name === 'Create Short') {
        console.log('\n⚠️  Skipping remaining tests due to short creation failure');
        break;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${tests.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});