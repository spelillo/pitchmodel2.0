/** @type {import('next').NextConfig} */
const repoName = 'pitchmodel2.0';
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: isProd ? `/${repoName}` : '',
  images: { unoptimized: true },
};

export default nextConfig;
