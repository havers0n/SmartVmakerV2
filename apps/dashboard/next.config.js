/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scrimspec/shared-types', '@scrimspec/db', '@project/api-client', '@project/shared-types'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@project/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@project/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@scrimspec/db': path.resolve(__dirname, '../../packages/db/src'),
      '@scrimspec/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
