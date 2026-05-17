import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import nextEnv from "@next/env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(__dirname, "..");
const frontendRoot = __dirname;

/**
 * Load env from monorepo root first (InsightBoard uses a single `.env` next to `frontend/`),
 * then `frontend/.env*`. Later files override earlier ones.
 * Edge Middleware inlines `NEXT_PUBLIC_*` at bundle time; this must run before `export default`.
 */
function loadAllEnv() {
  const candidates = [
    join(monorepoRoot, ".env"),
    join(monorepoRoot, ".env.local"),
    join(frontendRoot, ".env"),
    join(frontendRoot, ".env.local"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      dotenv.config({ path, override: true });
    }
  }
  nextEnv.loadEnvConfig(monorepoRoot, process.env.NODE_ENV !== "production");
}

loadAllEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
};

export default nextConfig;
