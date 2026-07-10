/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // pdf-parse pulls in some node-only deps; keep it server-side.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

module.exports = withPWA(nextConfig);
