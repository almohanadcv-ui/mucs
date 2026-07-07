// With `output: "standalone"`, `next build` writes a self-contained server to
// `.next/standalone/apps/web/` but does NOT copy the static assets (`.next/static`)
// or `public/` into it. When PM2 runs that standalone server directly, every
// `/_next/static/*` request 404s → a blank page. This postbuild step copies the
// assets in so the standalone server is actually serveable. No-op when the
// standalone output isn't present (e.g. plain `next start` deployments).
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const webRoot = process.cwd(); // apps/web
const standaloneWeb = join(webRoot, ".next", "standalone", "apps", "web");

if (!existsSync(standaloneWeb)) {
  console.log("[copy-standalone-assets] no standalone output — skipping.");
  process.exit(0);
}

cpSync(join(webRoot, ".next", "static"), join(standaloneWeb, ".next", "static"), {
  recursive: true,
});

if (existsSync(join(webRoot, "public"))) {
  cpSync(join(webRoot, "public"), join(standaloneWeb, "public"), { recursive: true });
}

console.log("[copy-standalone-assets] copied .next/static + public into standalone.");
