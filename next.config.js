/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org'
      }
    ]
  },
  async redirects() {
    return [
      {
        source: '/games/:path*',
        destination: '/play/:path*',
        permanent: true
      }
    ];
  }
};

module.exports = nextConfig;
