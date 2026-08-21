// Local dev database — a real PostgreSQL running inside the project, no install.
// Run this in its own terminal and leave it open while you develop.
//   node scripts/dev-db.mjs
// Connection: postgresql://postgres:postgres@localhost:5433/mab_portal
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".localdb");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true, // keep data between runs
  // Force UTF-8 so Arabic content is stored correctly (Windows defaults to WIN1252).
  initdbFlags: ["--encoding=UTF8", "--no-locale"],
});

const fresh = !existsSync(dataDir);
if (fresh) {
  console.log("⚙️  تهيئة قاعدة بيانات محلية لأول مرّة…");
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("mab_portal");
  console.log("🆕 أُنشئت قاعدة mab_portal");
} catch {
  /* موجودة مسبقًا */
}

console.log("\n✅ PostgreSQL المحلي يعمل على المنفذ 5433 (قاعدة: mab_portal).");
console.log("   الرابط: postgresql://postgres:postgres@localhost:5433/mab_portal");
console.log("   اتركه شغّالًا، وافتح نافذة أخرى لتشغيل التطبيق. (Ctrl+C للإيقاف)\n");

const stop = async () => {
  console.log("\n⏹️  إيقاف قاعدة البيانات المحلية…");
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
