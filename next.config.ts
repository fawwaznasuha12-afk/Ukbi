import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bank soal dibaca dari content/bank saat runtime; pastikan ikut dalam bundle serverless.
  outputFileTracingIncludes: {
    "/**": ["./content/bank/**/*.json"],
  },
};

export default nextConfig;
