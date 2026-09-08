#!/usr/bin/env bash
# Endpoint discovery — pulls the LIVE OpenAPI from the API (GET /api/docs-json)
# and derives the safe GET endpoints the read-only tests will hit. Never invents
# routes: if the API is down or exposes no spec, it fails loudly.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

BASE_URL="${BASE_URL:-http://127.0.0.1:4001}"; BASE_URL="${BASE_URL%/}"
DOCS_PATH="${DOCS_PATH:-/api/docs-json}"
OUT="$HERE/discovered"
mkdir -p "$OUT"

echo "🔎 Fetching OpenAPI: $BASE_URL$DOCS_PATH"
if ! curl -sS -m 20 -f "$BASE_URL$DOCS_PATH" -o "$OUT/openapi.json"; then
  echo "❌ Could not fetch $DOCS_PATH. Is the API up and Swagger enabled?"
  exit 1
fi

node - "$OUT/openapi.json" "$OUT" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
const [file, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(file, "utf8"));
const paths = spec.paths || {};

const all = [];
const safeGets = []; // GET with no *required path params* → safe to hit blindly
for (const [p, methods] of Object.entries(paths)) {
  for (const [m, op] of Object.entries(methods)) {
    if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
    const summary = (op && op.summary) || "";
    all.push(`${m.toUpperCase().padEnd(6)} ${p}${summary ? "  — " + summary : ""}`);
    if (m === "get" && !p.includes("{")) safeGets.push(p);
  }
}
all.sort();
safeGets.sort();

writeFileSync(`${outDir}/endpoints.md`,
  `# Discovered endpoints (${all.length})\n\n` + all.map((l) => "- " + l).join("\n") + "\n");
writeFileSync(`${outDir}/get-endpoints.json`, JSON.stringify(safeGets, null, 2) + "\n");

console.log(`  Total operations: ${all.length}`);
console.log(`  Safe GET (no path params): ${safeGets.length}`);
safeGets.slice(0, 20).forEach((p) => console.log(`    GET ${p}`));
if (safeGets.length > 20) console.log(`    … +${safeGets.length - 20} more`);
console.log(`  Written: ${outDir}/endpoints.md, ${outDir}/get-endpoints.json`);
NODE

echo "✅ Discovery complete."
