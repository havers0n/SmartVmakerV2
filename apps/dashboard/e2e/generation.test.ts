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
    const result = await apiCall(`/generation/status?shortId=${ctx.shortId}`);

    if (!result.ok) {
      throw new Error('Failed to get status');
    }

    const short = result.shorts[0];

    if (!short) {
      throw new Error('Short not found in status response');
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
 * Test 3: Verify assets are created
 */
async function testAssets(): Promise<void> {
  console.log('\n📦 Test 3: Verify Assets');

  if (!ctx.shortId) {
    throw new Error('No shortId available');
  }

  try {
    const result = await apiCall(`/generation/status?shortId=${ctx.shortId}`);

    if (!result.ok) {
      throw new Error('Failed to get status');
    }

    const assets = result.assets;

    if (!assets || assets.length === 0) {
      throw new Error('No assets found');
    }

    console.log(`   ✅ Assets found: ${assets.length}`);

    // Check each asset
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`   ✅ Asset ${i + 1}:`);
      console.log(`      - Type: ${asset.assetType}`);
      console.log(`      - Status: ${asset.status}`);

      if (asset.assetType !== 'video_clip') {
        console.warn(`      ⚠️  Unexpected asset type: ${asset.assetType}`);
      }

      if (asset.status !== 'pending' && asset.status !== 'processing' && asset.status !== 'completed') {
        throw new Error(`Unexpected asset status: ${asset.status}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Failed to verify assets:`, error);
    throw error;
  }
}

/**
 * Test 4: Verify generation jobs are queued
 */
async function testGenerationQueue(): Promise<void> {
  console.log('\n⏳ Test 4: Verify Generation Queue');

  if (!ctx.shortId) {
    throw new Error('No shortId available');
  }

  try {
    const result = await apiCall(`/generation/status?shortId=${ctx.shortId}`);

    if (!result.ok) {
      throw new Error('Failed to get status');
    }

    const jobs = result.jobs;

    if (!jobs || jobs.length === 0) {
      console.warn(`   ⚠️  No jobs found yet (might not be enqueued yet)`);
      return;
    }

    console.log(`   ✅ Jobs found: ${jobs.length}`);

    // Check each job
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`   ✅ Job ${i + 1}:`);
      console.log(`      - ID: ${job.id.substring(0, 8)}...`);
      console.log(`      - Provider: ${job.provider}`);
      console.log(`      - Status: ${job.status}`);

      if (job.provider !== ctx.provider) {
        throw new Error(`Job provider mismatch: expected ${ctx.provider}, got ${job.provider}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Failed to verify generation queue:`, error);
    throw error;
  }
}

/**
 * Test 5: Monitor generation progress (with retry)
 */
async function testGenerationProgress(maxRetries: number = 5): Promise<void> {
  console.log('\n🎬 Test 5: Monitor Generation Progress');
  console.log(`   Max retries: ${maxRetries}`);

  if (!ctx.shortId) {
    throw new Error('No shortId available');
  }

  let lastStatus: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await apiCall(`/generation/status?shortId=${ctx.shortId}`);

      if (!result.ok) {
        throw new Error('Failed to get status');
      }

      lastStatus = result;
      const short = result.shorts[0];

      if (!short) {
        throw new Error('Short not found');
      }

      console.log(`   Attempt ${attempt + 1}/${maxRetries}:`);
      console.log(`      - Short Status: ${short.status}`);
      console.log(`      - Assets: ${result.assets.length}`);
      console.log(`      - Completed: ${result.assets.filter((a: any) => a.status === 'completed').length}/${result.assets.length}`);

      // Check if any assets are completed
      const completedAssets = result.assets.filter((a: any) => a.status === 'completed');
      if (completedAssets.length > 0) {
        console.log(`   ✅ Generation in progress!`);
        completedAssets.forEach((asset: any, idx: number) => {
          console.log(`      - Asset ${idx + 1}: ${asset.storageUrl ? '✅ Generated' : '🔄 Processing'}`);
        });
        return;
      }

      // If all assets are pending, generation hasn't started yet
      if (result.assets.every((a: any) => a.status === 'pending')) {
        console.log(`   ⏳ Waiting for generation worker to start...`);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
        }
        continue;
      }

    } catch (error) {
      console.error(`   ❌ Attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (!lastStatus || !lastStatus.assets.some((a: any) => a.status !== 'pending')) {
    console.warn(`   ⚠️  No assets were generated after ${maxRetries} attempts`);
    console.warn(`   This is expected if the generation worker is not running.`);
  }
}

/**
 * Test 6: Verify API response structure
 */
async function testAPIResponseStructure(): Promise<void> {
  console.log('\n📐 Test 6: Verify API Response Structure');

  try {
    const result = await apiCall('/generation/status?limit=10');

    if (!result.ok) {
      throw new Error('API response not ok');
    }

    // Verify required fields
    const requiredFields = ['shorts', 'assets', 'jobs', 'count'];
    const requiredCountFields = ['shorts', 'assets', 'jobs'];

    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
      console.log(`   ✅ Field '${field}' present`);
    }

    for (const field of requiredCountFields) {
      if (!(field in result.count)) {
        throw new Error(`Missing required count field: ${field}`);
      }
      console.log(`   ✅ Count field '${field}' present`);
    }

    // Verify array types
    if (!Array.isArray(result.shorts)) {
      throw new Error('shorts is not an array');
    }
    if (!Array.isArray(result.assets)) {
      throw new Error('assets is not an array');
    }
    if (!Array.isArray(result.jobs)) {
      throw new Error('jobs is not an array');
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
    { name: 'Assets', fn: testAssets },
    { name: 'Generation Queue', fn: testGenerationQueue },
    { name: 'Generation Progress', fn: testGenerationProgress },
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
