import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O sistema visual é distribuído como fonte TypeScript e CSS (ADR-0017).
  transpilePackages: ['@prometeu/ui'],
};

export default config;
