/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scrimspec/shared-types', '@scrimspec/db'],
};

module.exports = nextConfig;
