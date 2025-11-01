import 'dotenv/config';
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
  forcePathStyle: true,
});

try {
  // Иногда у токена может не быть ListBuckets — сразу проверим бакет
  const out = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET }));
  console.log('✅ Connected! Sample keys:', (out.Contents || []).slice(0, 5).map(o => o.Key));
} catch (e) {
  console.error('❌ Connection failed:', e.name, e.message);
  if (e.$metadata?.httpStatusCode) console.error('HTTP:', e.$metadata.httpStatusCode);
  if (e.Code) console.error('Code:', e.Code);
}
