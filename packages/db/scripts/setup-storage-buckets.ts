import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { getSupabaseClient } from '../src/client';

/**
 * Setup Storage Buckets
 *
 * This script ensures that all required Supabase Storage buckets exist.
 * Run this script after creating a new Supabase project or before running workers.
 */

async function setupStorageBuckets() {
  console.log('🗂️  Setting up Supabase Storage buckets...\n');

  const supabase = getSupabaseClient();

  // Define required buckets
  const requiredBuckets = [
    {
      name: 'keyframes',
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    },
  ];

  for (const bucketConfig of requiredBuckets) {
    console.log(`Checking bucket: ${bucketConfig.name}`);

    // Check if bucket exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error(`❌ Failed to list buckets: ${listError.message}`);
      continue;
    }

    const bucketExists = existingBuckets?.some((b) => b.name === bucketConfig.name);

    if (bucketExists) {
      console.log(`  ✅ Bucket "${bucketConfig.name}" already exists`);
      continue;
    }

    // Create bucket
    console.log(`  📦 Creating bucket "${bucketConfig.name}"...`);

    const { data, error } = await supabase.storage.createBucket(bucketConfig.name, {
      public: bucketConfig.public,
      fileSizeLimit: bucketConfig.fileSizeLimit,
      allowedMimeTypes: bucketConfig.allowedMimeTypes,
    });

    if (error) {
      console.error(`  ❌ Failed to create bucket: ${error.message}`);
      continue;
    }

    console.log(`  ✅ Bucket "${bucketConfig.name}" created successfully`);
  }

  console.log('\n✨ Storage bucket setup complete!\n');
}

// Run the setup
setupStorageBuckets()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
