// Analyzer — turns a run's raw output (k6 summary + per-second monitor CSV) into
// a human report: PASS/FAIL, the peak numbers, and — the point of the whole lab
// — WHICH resource was the bottleneck and the likely ROOT CAUSE.
//
//   node monitoring/analyze.mjs <run-dir>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { THRESHOLDS, ABORT } from "../config/config.js";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node monitoring/analyze.mjs <run-dir>");
  process.exit(1);
}

// ── k6 summary ────────────────────────────────────────────────────────────────
const summaryPath = `${dir}/k6-summary.json`;
let m = {};
if (existsSync(summaryPath)) {
  const s = JSON.parse(readFileSync(summaryPath, "utf8"));
  m = s.metrics || {};
} else {
  console.warn(`⚠️  no k6 summary at ${summaryPath}`);
}
const dur = m.http_req_duration || {};
const p95 = dur["p(95)"] ?? null;
const p99 = dur["p(99)"] ?? null;
const reqs = m.http_reqs?.count ?? null;
const rps = m.http_reqs?.rate ?? null;
const errRate = m.http_req_failed?.value ?? null; // 0..1
const vusMax = m.vus_max?.max ?? m.vus_max?.value ?? null;

// ── monitor CSV → peaks ───────────────────────────────────────────────────────
const peaks = {};
const csvPath = `${dir}/monitor.csv`;
let rows = [];
if (existsSync(csvPath)) {
  const lines = readFileSync(csvPath, "utf8").trim().split("\n");
  const head = lines.shift().split(",");
  rows = lines.map((l) => {
    const c = l.split(",");
    const o = {};
    head.forEach((h, i) => (o[h] = c[i] === "" ? null : Number(c[i])));
    return o;
  });
  const max = (k) => rows.reduce((a, r) => (r[k] != null && r[k] > a ? r[k] : a), 0);
  peaks.cpu = max("cpu_pct");
  peaks.mem = max("mem_pct");
  peaks.load1 = max("load1");
  peaks.pgConn = max("pg_conn");
  peaks.pgActive = max("pg_active");
  peaks.pgWaiting = max("pg_waiting");
  peaks.pgLocks = max("pg_locks");
  peaks.pgMax = max("pg_max_conn");
  peaks.redisMem = max("redis_mem_mb");
  peaks.redisClients = max("redis_clients");
  peaks.bullWaiting = max("bull_waiting");
  peaks.bullFailed = max("bull_failed");
  peaks.netRx = max("net_rx_kbps");
  peaks.netTx = max("net_tx_kbps");
}

// ── PASS/FAIL ─────────────────────────────────────────────────────────────────
const fails = [];
if (p95 != null && p95 > THRESHOLDS.p95Ms) fails.push(`p95 ${p95.toFixed(0)}ms > ${THRESHOLDS.p95Ms}ms`);
if (p99 != null && p99 > THRESHOLDS.p99Ms) fails.push(`p99 ${p99.toFixed(0)}ms > ${THRESHOLDS.p99Ms}ms`);
if (errRate != null && errRate > THRESHOLDS.errorRate)
  fails.push(`errors ${(errRate * 100).toFixed(2)}% > ${(THRESHOLDS.errorRate * 100).toFixed(1)}%`);
const pass = fails.length === 0;

// ── Bottleneck + root cause (correlation heuristics) ──────────────────────────
const pgPct = peaks.pgMax ? (peaks.pgConn / peaks.pgMax) * 100 : 0;
let bottleneck = "لا يوجد عنق زجاجة واضح ضمن النطاق المُختبَر";
let rootCause = "الأداء ظلّ ضمن الحدود؛ الموارد لم تُشبَع.";
const recs = [];

if (rows.length === 0) {
  bottleneck = "غير معروف (لا توجد بيانات مراقبة)";
  rootCause = "لم يُشغَّل server-monitor.sh على الخادم أثناء الاختبار.";
  recs.push("شغّل المراقبة على الخادم (MONITOR=1) لربط الأداء بالموارد.");
} else if (pgPct >= 85 || (peaks.pgWaiting || 0) > 5 || (peaks.pgLocks || 0) > 5) {
  bottleneck = "Postgres — اتصالات/أقفال";
  rootCause = `اتصالات PG بلغت ${peaks.pgConn}/${peaks.pgMax} (${pgPct.toFixed(0)}%)، انتظار=${peaks.pgWaiting}, أقفال=${peaks.pgLocks}. تشبّع تجمّع الاتصالات يرفع الكمون.`;
  recs.push("زد pool size / أضف PgBouncer، راجع الاستعلامات البطيئة والفهارس، قلّل الاتصالات لكل عملية.");
} else if ((peaks.cpu || 0) >= 85) {
  bottleneck = "CPU على الخادم";
  rootCause = `ذروة CPU ${peaks.cpu}% مع load ${peaks.load1}. المعالجة (تسلسل/تحويل/عمليات متزامنة) هي القيد.`;
  recs.push("أضف نسخ PM2 (cluster) أو ارفع النواة، خزّن المخرجات المتكررة (cache)، خفّف العمل المتزامن.");
} else if ((peaks.mem || 0) >= 85) {
  bottleneck = "الذاكرة (RAM)";
  rootCause = `ذروة استخدام الذاكرة ${peaks.mem}%. ضغط الذاكرة يسبّب GC/تبديل ويبطئ الاستجابة.`;
  recs.push("راجع تسرّب الذاكرة، حدّد حجم الحمولات/الرفع، ارفع RAM أو خفّض التزامن.");
} else if ((peaks.bullWaiting || 0) > 100 || (peaks.bullFailed || 0) > 0) {
  bottleneck = "طابور BullMQ (Redis)";
  rootCause = `تراكم المهام في الطابور بلغ ${peaks.bullWaiting} (فشل=${peaks.bullFailed}). المعالِجات لا تلحق بمعدّل الإنتاج.`;
  recs.push("زد عدد workers/التزامن للمعالِجات، راجع أخطاء المعالجة، افصل الطوابير الثقيلة.");
} else if ((peaks.redisMem || 0) > 0 && (peaks.redisClients || 0) > 500) {
  bottleneck = "Redis — عملاء/ذاكرة";
  rootCause = `عملاء Redis بلغ ${peaks.redisClients} وذاكرة ${peaks.redisMem}MB.`;
  recs.push("راجع سياسة الإخلاء (maxmemory-policy)، جمّع الاتصالات، قلّل مفاتيح BullMQ المتراكمة.");
} else if (errRate != null && errRate > THRESHOLDS.errorRate) {
  bottleneck = "التطبيق (أخطاء/مهلات) دون إشباع موارد";
  rootCause = `معدّل الأخطاء ${(errRate * 100).toFixed(2)}% بينما الموارد دون الإشباع — الأرجح مهلات، محدوديّة معدّل (throttler)، أو أخطاء منطقية.`;
  recs.push("افحص سجلّات mica-api، راجع حدود throttler، وأكواد الأخطاء الغالبة في k6.");
}

// ── Report ────────────────────────────────────────────────────────────────────
const fmt = (v, s = "") => (v == null ? "—" : `${typeof v === "number" ? v.toLocaleString() : v}${s}`);
const report = `# تقرير اختبار التحمّل — ${dir.split("/").pop()}

## النتيجة: ${pass ? "✅ PASS" : "❌ FAIL"}
${fails.length ? fails.map((f) => `- ❌ ${f}`).join("\n") : "- كل الحدود ضمن المسموح."}

## الأرقام الرئيسية
| المقياس | القيمة |
|---|---|
| أقصى مستخدمين (VUs) | ${fmt(vusMax)} |
| إجمالي الطلبات | ${fmt(reqs)} |
| ذروة RPS | ${fmt(rps != null ? Math.round(rps) : null)} |
| P95 | ${fmt(p95 != null ? Math.round(p95) : null, "ms")} |
| P99 | ${fmt(p99 != null ? Math.round(p99) : null, "ms")} |
| معدّل الأخطاء | ${errRate != null ? (errRate * 100).toFixed(2) + "%" : "—"} |

## ذروة الموارد على الخادم
| المورد | الذروة |
|---|---|
| CPU | ${fmt(peaks.cpu, "%")} |
| RAM | ${fmt(peaks.mem, "%")} |
| Load(1m) | ${fmt(peaks.load1)} |
| PG connections | ${fmt(peaks.pgConn)} / ${fmt(peaks.pgMax)} (${pgPct ? pgPct.toFixed(0) + "%" : "—"}) |
| PG active / waiting / locks | ${fmt(peaks.pgActive)} / ${fmt(peaks.pgWaiting)} / ${fmt(peaks.pgLocks)} |
| Redis mem / clients | ${fmt(peaks.redisMem, "MB")} / ${fmt(peaks.redisClients)} |
| BullMQ waiting / failed | ${fmt(peaks.bullWaiting)} / ${fmt(peaks.bullFailed)} |
| Net rx / tx | ${fmt(peaks.netRx, "kB/s")} / ${fmt(peaks.netTx, "kB/s")} |

## 🎯 عنق الزجاجة الرئيسي
**${bottleneck}**

## 🔬 السبب الجذري المرجّح
${rootCause}

## ✅ التوصيات
${recs.length ? recs.map((r) => `- ${r}`).join("\n") : "- لا توجد إجراءات عاجلة؛ يمكن رفع الحمل للرُّبع التالي."}

---
_حدود القبول: p95<${THRESHOLDS.p95Ms}ms · p99<${THRESHOLDS.p99Ms}ms · أخطاء<${(THRESHOLDS.errorRate * 100).toFixed(1)}% · إجهاض تلقائي عند أخطاء>${(ABORT.errorRate * 100).toFixed(0)}% أو p95>${ABORT.p95Ms}ms مُستدام._
`;

writeFileSync(`${dir}/report.md`, report);
console.log(report);
console.log(`\n📄 Saved: ${dir}/report.md`);
process.exit(pass ? 0 : 2);
