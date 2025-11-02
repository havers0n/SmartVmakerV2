import 'dotenv/config'; // Убеждаемся, что переменные из .env загружены
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Проверяем наличие всех необходимых переменных
const requiredEnv = ['R2_ENDPOINT', 'R2_ACCESS_KEY', 'R2_SECRET_KEY', 'R2_BUCKET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error('❌ Missing required R2 environment variables:', missingEnv.join(', '));
  process.exit(1);
}

console.log(`- 🌐 Endpoint: ${process.env.R2_ENDPOINT}`);
console.log(`- 🪣 Bucket: ${process.env.R2_BUCKET}`);
console.log('- 🔑 Access Key ID: Present');
console.log('- 🤫 Secret Access Key: Present');
console.log('\nAttempting to connect to R2...');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
  forcePathStyle: true,
});

try {
  const command = new ListObjectsV2Command({ 
    Bucket: process.env.R2_BUCKET,
    MaxKeys: 5, // Запрашиваем только 5 ключей для скорости
  });
  
  const out = await s3.send(command);
  
  console.log('\n✅ Connection to R2 successful!');
  const keys = (out.Contents || []).map(o => o.Key);
  
  if (keys.length > 0) {
    console.log('🔍 Found sample keys in bucket:', keys);
  } else {
    console.log('텅 Empty bucket. No keys found, but connection is OK.');
  }

} catch (e) {
  console.error('\n❌ Connection to R2 failed!');
  console.error('   Error Name:', e.name);
  console.error('   Error Message:', e.message);
  if (e.$metadata?.httpStatusCode) {
    console.error('   HTTP Status Code:', e.$metadata.httpStatusCode);
  }
  if (e.Code) {
    console.error('   S3 Error Code:', e.Code);
    if (e.Code === 'InvalidAccessKeyId') {
        console.error('   💡 Tip: Check your R2_ACCESS_KEY.');
    }
    if (e.Code === 'SignatureDoesNotMatch') {
        console.error('   💡 Tip: Check your R2_SECRET_KEY.');
    }
  }
}