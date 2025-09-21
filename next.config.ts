import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Configure port for Docker
  env: {
    PORT: '3777',
  }
};

export default nextConfig;
