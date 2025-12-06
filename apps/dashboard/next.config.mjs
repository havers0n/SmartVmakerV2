import path from 'path';
import { fileURLToPath } from 'url';


// Получаем путь к текущей директории в ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scrimspec/shared-types', '@scrimspec/db', '@scrimspec/hwar-core', '@project/api-client', '@project/shared-types'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-fd57dec48e2f4f94841a42456bfe0eec.r2.dev",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@project/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@project/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@scrimspec/db': path.resolve(__dirname, '../../packages/db/src'),
      '@scrimspec/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@scrimspec/hwar-core': path.resolve(__dirname, '../../packages/hwar-core/src'),
      '@scrimspec/hwar-core/providers': path.resolve(__dirname, '../../packages/hwar-core/src/providers'),
    };
    return config;
  },
};

export default nextConfig;