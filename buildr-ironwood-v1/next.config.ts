import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    "cautious-waffle-xr99x75v94qr2p6g9-3000.app.github.dev",
    "*.app.github.dev",
  ],

  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "cautious-waffle-xr99x75v94qr2p6g9-3000.app.github.dev",
        "*.app.github.dev",
      ],
    },
  },
};

export default nextConfig;