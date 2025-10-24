/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scrimspec/shared-types', '@scrimspec/db', '@project/api-client', '@project/shared-types'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@project/api-client': require('path').resolve(__dirname, '../../packages/api-client/src'),
      '@project/shared-types': require('path').resolve(__dirname, '../../packages/shared-types/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
