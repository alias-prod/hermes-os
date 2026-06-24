import path from "node:path";
import type { NextConfig } from "next";

// Hermes OS is a standalone web client for the Hermes OpenAI-compatible API
// server. Static export keeps the app hostable from any static web server.
const isStaticExport = process.env["NEXT_OUTPUT"] !== "server";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  reactStrictMode: false,
  allowedDevOrigins: ["100.100.98.17"],
  turbopack: { root: path.resolve(__dirname, "../..") },
  images: { unoptimized: true },
};

export default nextConfig;
