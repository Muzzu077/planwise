/**
 * Generate _redirects file for Netlify deployment.
 * Routes /api/* requests to the backend API.
 *
 * Usage: Set BACKEND_URL env var to your deployed backend,
 * or it defaults to the Railway backend placeholder.
 */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "out");

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const content = `/api/*  ${backendUrl}/:splat  200\n`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "_redirects"), content, "utf-8");
console.log(`_redirects -> ${outDir}/_redirects`);
console.log(`  /api/* -> ${backendUrl}/:splat`);
