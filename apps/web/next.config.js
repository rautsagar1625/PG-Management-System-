const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: [
    '@pg-system/ui',
    '@pg-system/types',
    '@pg-system/constants',
    '@pg-system/utils',
    '@pg-system/validations',
  ],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
};

// Only wrap with Sentry when DSN is configured — safe to omit locally
const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

module.exports = hasSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;
