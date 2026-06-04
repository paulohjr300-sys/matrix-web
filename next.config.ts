import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://matrix-web.vercel.app", "http://localhost:3000"],
};

export default nextConfig;
