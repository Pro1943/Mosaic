/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiBase = (process.env.NEXT_PUBLIC_MOSAIC_API_URL || 'https://mosaic-api-avi4.onrender.com').replace(/\/$/, '')
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
