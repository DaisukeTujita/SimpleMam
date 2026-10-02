import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Direct access (development or no-nginx startup) forwards API/media to FastAPI.
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
