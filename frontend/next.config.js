/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vercel uses ESLint v9, but Next 13 passes CLI flags removed in v9.
    // Disable lint during build to unblock deploy. Keep `npm run lint` locally.
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
