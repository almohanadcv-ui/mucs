/**
 * Measure the round trip from THIS machine to the database.
 *
 * Run it on the server, not a laptop: what users feel is the server's latency
 * to the database, and a developer's home connection says nothing about it.
 *
 *   pnpm db:latency
 *
 * `SELECT 1` does no work, so its timing is purely the network round trip plus
 * protocol overhead. That number is the floor for every page in the app: no
 * amount of code tuning gets a request below the trips it must make.
 */
import { PrismaClient } from "@prisma/client";
import os from "node:os";

const prisma = new PrismaClient();

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
  };
}

async function time(fn: () => Promise<unknown>): Promise<number> {
  const t = Date.now();
  await fn();
  return Date.now() - t;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/?]+)/)?.[1] ?? "غير معروف";
  console.log("قاعدة البيانات:", host);
  console.log("أنوية المعالج:", os.cpus().length);
  console.log(
    "connection_limit:",
    (process.env.DATABASE_URL ?? "").includes("connection_limit")
      ? "محدَّد في الرابط"
      : `افتراضي التطبيق (15)`,
  );
  console.log("");

  const cold = await time(() => prisma.$queryRaw`SELECT 1`);
  console.log(`أول اتصال (يشمل المصافحة والاستيقاظ من السبات): ${cold}ms`);

  const warm: number[] = [];
  for (let i = 0; i < 8; i++) warm.push(await time(() => prisma.$queryRaw`SELECT 1`));
  const s = stats(warm);
  console.log(
    `رحلة واحدة دافئة: الوسيط ${s.median}ms (أدنى ${s.min} / أعلى ${s.max} / متوسط ${s.avg})`,
  );

  const parallel = await time(() =>
    Promise.all(Array.from({ length: 11 }, () => prisma.$queryRaw`SELECT 1`)),
  );
  console.log(`11 استعلامًا متوازيًا (مثل لوحة المعلومات): ${parallel}ms`);
  console.log("");

  const median = s.median;
  console.log("الخلاصة:");
  if (median < 50) {
    console.log("  ✅ الشبكة ممتازة. أي بطء متبقٍ سببه الكود أو الواجهة، لا الشبكة.");
  } else if (median < 150) {
    console.log("  ✅ الشبكة جيدة. تسجيل الدخول ≈", median * 2, "مللي.");
  } else {
    console.log(
      `  ⚠️ الشبكة بطيئة: كل رحلة ${median}ms. تسجيل الدخول ≈ ${median * 2}ms مهما حسّنّا الكود.`,
    );
    console.log(
      "  السبب: قاعدة البيانات في منطقة جغرافية بعيدة عن هذا السيرفر.",
    );
    console.log(
      "  الحل الوحيد الفعّال: نقل قاعدة البيانات إلى منطقة قريبة (مثل eu-central-1).",
    );
  }
  if (parallel > median * 3) {
    console.log(
      `  ⚠️ التوازي ضعيف (${parallel}ms مقابل ${median}ms للرحلة الواحدة): المسبح يصطف.`,
    );
    console.log("     جرّب رفع DATABASE_CONNECTION_LIMIT.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("فشل القياس:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
