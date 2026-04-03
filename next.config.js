/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'cdn.espn.com' },
      { protocol: 'https', hostname: 'secure.espncdn.com' },
    ],
  },
};

module.exports = nextConfig;
