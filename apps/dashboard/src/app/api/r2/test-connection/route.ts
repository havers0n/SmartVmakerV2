import { NextResponse } from 'next/server';
import { r2, R2_BUCKET } from '@aec/storage-client';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createLogger } from '@aec/logger';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

const logger = createLogger({ name: 'api-r2-test-connection' });

/**
 * GET /api/r2/test-connection
 *
 * Test R2 connection and configuration
 * Returns connection status, bucket info, and sample objects
 */
export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Middleware injects trusted authenticated user id.
    const userId = getTrustedUserId(req);
    if (!userId) return unauthorizedResponse();

    // Check environment variables
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;

    const config = {
      hasAccountId: !!r2AccountId,
      hasAccessKey: !!r2AccessKeyId,
      hasSecretKey: !!r2SecretAccessKey,
      hasPublicBaseUrl: !!publicBaseUrl,
      bucketName: R2_BUCKET,
      publicBaseUrl: publicBaseUrl || null,
    };

    // Try to list objects in the bucket
    let bucketTest: {
      success: boolean;
      error?: string;
      objectCount?: number;
      sampleKeys?: string[];
    } = { success: false };

    try {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        MaxKeys: 10,
      });

      const response = await r2.send(command);
      bucketTest = {
        success: true,
        objectCount: response.KeyCount || 0,
        sampleKeys: response.Contents?.slice(0, 5).map((obj) => obj.Key || '') || [],
      };
    } catch (error: any) {
      bucketTest = {
        success: false,
        error: error.message || 'Unknown error',
      };
      logger.error({ error }, 'Failed to list R2 objects');
    }

    return NextResponse.json(
      {
        config,
        bucketTest,
        status: bucketTest.success ? 'connected' : 'error',
        message: bucketTest.success
          ? 'R2 connection successful'
          : `R2 connection failed: ${bucketTest.error}`,
      },
      { status: bucketTest.success ? 200 : 500 }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to test R2 connection');
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        status: 'error',
        error: message,
      },
      { status: 500 }
    );
  }
}


