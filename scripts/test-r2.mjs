import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

console.log('--- R2 Connection Test ---');

// 1. Используем ВАШИ имена переменных
const requiredEnv = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',    // ИЗМЕНЕНО
  'R2_SECRET_ACCESS_KEY',  // ИЗМЕНЕНО
  'R2_BUCKET_NAME',      // ИЗМЕНЕНО
];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error('\n❌ ERROR: Missing required environment variables in your .env file:');
  console.error(`   - ${missingEnv.join('\n   - ')}`);
  console.error('\nPlease add them and try again.');
  process.exit(1);
}

// 2. Автоматически конструируем R2_ENDPOINT
const accountId = process.env.R2_ACCOUNT_ID;
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const bucketName = process.env.R2_BUCKET_NAME; // Используем правильное имя

console.log('\n🔍 Configuration found in .env:');
console.log(`- Account ID: ...${accountId.slice(-4)}`);
console.log(`- Bucket Name: ${bucketName}`);
console.log(`- Endpoint (auto-generated): ${endpoint}`);
console.log(`- Access Key ID: ...${process.env.R2_ACCESS_KEY_ID.slice(-4)}`);
console.log('- Secret Access Key: ******');
console.log('\n🚀 Attempting to connect to R2...');

// 3. Создаем S3 клиент, используя правильные переменные
const s3 = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,     // ИЗМЕНЕНО
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, // ИЗМЕНЕНО
  },
  forcePathStyle: true,
});

// 4. Пытаемся выполнить команду
try {
  const command = new ListObjectsV2Command({ 
    Bucket: bucketName, // ИЗМЕНЕНО
    MaxKeys: 5,
  });
  
  const out = await s3.send(command);
  
  console.log('\n✅ SUCCESS! Connection to R2 is working correctly.');
  const keys = (out.Contents || []).map(o => o.Key);
  
  if (keys.length > 0) {
    console.log('   - Found a few keys in the bucket:', keys);
  } else {
    console.log('   - The bucket is empty, which is fine. The connection is established.');
  }

} catch (e) {
  console.error('\n❌ FAILURE! Connection to R2 failed.');
  console.error('   - Error Name:', e.name);
  if (e.$metadata?.httpStatusCode) {
    console.error('   - HTTP Status Code:', e.$metadata.httpStatusCode);
  }
  if (e.Code) {
    console.error('   - S3 Error Code:', e.Code);
    console.error('\n   --- Common Causes & Solutions ---');
    switch (e.Code) {
        case 'InvalidAccessKeyId':
            console.error('   💡 Check your R2_ACCESS_KEY_ID. It seems to be incorrect.');
            break;
        case 'SignatureDoesNotMatch':
            console.error('   💡 Check your R2_SECRET_ACCESS_KEY. It seems to be incorrect.');
            break;
        case 'NoSuchBucket':
            console.error(`   💡 The bucket "${bucketName}" does not seem to exist. Check the R2_BUCKET_NAME variable.`);
            break;
        default:
            console.error('   💡 This is an unexpected error. Check your R2_ACCOUNT_ID and bucket permissions in the Cloudflare dashboard.');
            break;
    }
  } else {
     console.error('   - Error Message:', e.message);
  }
}