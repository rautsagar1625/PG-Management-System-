/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pg-system/ui', '@pg-system/types', '@pg-system/constants', '@pg-system/utils', '@pg-system/validations'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
};

module.exports = nextConfig;
