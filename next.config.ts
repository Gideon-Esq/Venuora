import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep a concurrently running `next build` / `next start` from replacing
    // the development server's route manifests and generated modules.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-development" : ".next",
  };
}
