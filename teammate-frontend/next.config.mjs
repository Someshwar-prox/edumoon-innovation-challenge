/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

const nextConfig = {
  // Stop type errors from blocking the dev server while we still wire
  // the frontend up. Remove once `tsc --noEmit` is clean.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Proxy /api/* and /uploads/* to the fixed-backend gateway in dev
  // so the browser can keep calling relative URLs and we don't fight
  // CORS. The routes here are the only place we hardcode BACKEND_URL.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_URL}/uploads/:path*` },
      { source: '/health/:path*', destination: `${BACKEND_URL}/health/:path*` },
    ]
  },
}

export default nextConfig
