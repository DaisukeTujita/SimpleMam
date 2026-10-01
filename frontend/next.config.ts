import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Browser API requests go through nginx in production. This is only for `npm run dev`.
  async rewrites() {
    const backend = process.env.SIMPLEMAM_BACKEND_URL;
    return backend
      ? [
          { source: "/api/:path*", destination: `${backend}/api/:path*` },
          { source: "/media/:path*", destination: `${backend}/media/:path*` },
        ]
      : [];
  },
};
export default config;
