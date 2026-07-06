import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { db } from './db/index.js';
import { ensureSeed } from './db/seed.js';
import { applyPasswordResets, backfillPasswordPlain } from './db/passwordWatch.js';
import { errorHandler } from './middleware/error.js';
import { audit } from './services/audit.js';
import { notify } from './services/notifications.js';

import authRoutes from './routes/auth.js';
import requestRoutes from './routes/requests.js';
import permitRoutes from './routes/permits.js';
import userRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/reports.js';
import verifyRoutes from './routes/verify.js';
import notificationRoutes from './routes/notifications.js';
import testMatchRoutes from './routes/testMatch.js'; // PoC: اختبار مطابقة التصاريح (قراءة فقط)
import waAdminRoutes from './routes/wa-admin.js'; // إدارة منصّة واتساب (دعم فقط)
import { startWhatsAppAgent } from './services/whatsappAgent.js'; // وكيل واتساب (مُطفأ افتراضياً)
import { startWorker } from './services/wa/queue.js'; // طابور منصّة واتساب (مُطفأ افتراضياً)
import { sweepTimedOutPackages } from './services/wa/packageBuilder.js'; // يسجّل معالِج 'wa.doc' + مسح المهلة (الدفعة 2/3)
import { startHourlyExport } from './services/wa/exporter.js'; // التصدير الساعي + معالِج الإرسال (الدفعة 3)
import { startDistributor } from './services/wa/distributor.js'; // موزّع التصاريح (طابور منفصل، الدفعة 4)
import './services/wa/faceMatch.js'; // يسجّل معالِج 'wa.facematch' (اختياري، خلف WA_FACEMATCH_ENABLED)
import './services/wa/batchProcessor.js'; // يسجّل معالِج 'wa.batch' (مطابقة الوجه عبر الدفعة)
import './services/wa/permitProcessor.js'; // يسجّل معالِجَي 'wa.permit' و 'wa.permit_report' (تصاريح المراجِع)

// في الإنتاج: ارفض الإقلاع بمفتاح غير آمن (منع تسريب/اختراق الجلسات)
if (config.env === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('⛔ توقّف: يجب ضبط JWT_SECRET قوي (32 حرفاً فأكثر) في الإنتاج.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// الأمان والوسطاء العامة (Helmet + CSP + HSTS)
app.use(helmet({
  hsts: config.env === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"], // السماح بمعالجات onclick/onsubmit المضمّنة
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ["'self'"],
      objectSrc: ["'self'"],
      connectSrc: ["'self'"],
      // لا نُجبر ترقية الطلبات إلى HTTPS تلقائياً (يكسر التحميل عند الوصول عبر http/IP).
      upgradeInsecureRequests: null,
    },
  },
  // هذه الرؤوس تتطلب HTTPS وتكسر التحميل على http — نعطّلها مؤقتاً (تُفعّل بعد تركيب الشهادة)
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// تحديد معدّل الطلبات على المصادقة (حماية من التخمين)
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'محاولات دخول كثيرة. حاول بعد قليل.' } }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// المسارات
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/test-permit-match', testMatchRoutes); // PoC (قراءة فقط)
app.use('/api/wa', waAdminRoutes); // إدارة منصّة واتساب (دعم فقط)

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// الواجهة الأمامية الثابتة
app.use(express.static(config.paths.public));

// معالج الأخطاء (يجب أن يكون أخيراً)
app.use(errorHandler);

// ---------------------------------------------------------------
// مهمة مجدولة: إنهاء التصاريح المنتهية تلقائياً
// ---------------------------------------------------------------
function staffUserIds() {
  return db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code IN ('reviewer','support') AND u.is_active=1
  `).all().map((x) => x.id);
}

function expirePermits() {
  const today = new Date().toISOString().slice(0, 10);

  // 1) إنهاء التصاريح المنتهية
  const expired = db.prepare(`SELECT * FROM permits WHERE status='active' AND valid_to < ?`).all(today);
  for (const p of expired) {
    db.prepare(`UPDATE permits SET status='expired' WHERE id=?`).run(p.id);
    db.prepare(`UPDATE permit_requests SET status='expired', updated_at=datetime('now')
                WHERE id=? AND status='approved'`).run(p.request_id);
    audit({ action: 'EXPIRE', entityType: 'permit', entityId: p.id,
      oldValue: { status: 'active' }, newValue: { status: 'expired' } });
    const r = db.prepare(`SELECT created_by FROM permit_requests WHERE id=?`).get(p.request_id);
    notify({ userId: r?.created_by, reqId: p.request_id, title: 'انتهى تصريحك', body: `${p.permit_number} انتهت صلاحيته.` });
  }
  if (expired.length) console.log(`⏰ تم إنهاء ${expired.length} تصريح منتهٍ.`);

  // 2) تنبيه يومي قبل (renewalWindowDays) أيام من الانتهاء — للمقدّم وكل الموظفين
  const limit = new Date(); limit.setDate(limit.getDate() + config.renewalWindowDays);
  const limitStr = limit.toISOString().slice(0, 10);
  const soon = db.prepare(`
    SELECT * FROM permits
    WHERE status='active' AND valid_to <= ? AND (last_expiry_notice IS NULL OR last_expiry_notice != ?)
  `).all(limitStr, today);
  const staff = staffUserIds();
  for (const p of soon) {
    const daysLeft = Math.max(0, Math.ceil((new Date(p.valid_to + 'T00:00:00Z') - new Date()) / 86400000));
    const r = db.prepare(`SELECT created_by FROM permit_requests WHERE id=?`).get(p.request_id);
    const body = `${p.permit_number} ينتهي خلال ${daysLeft} يوم/أيام (بتاريخ ${p.valid_to}).`;
    notify({ userId: r?.created_by, reqId: p.request_id, title: 'تصريحك على وشك الانتهاء — جدّد الآن', body });
    for (const uid of staff) notify({ userId: uid, reqId: p.request_id, title: 'تصريح يقترب من الانتهاء', body: `${body} — ${p.holder_name}` });
    db.prepare(`UPDATE permits SET last_expiry_notice=? WHERE id=?`).run(today, p.id);
  }
  if (soon.length) console.log(`🔔 تنبيهات قرب الانتهاء: ${soon.length}.`);
}

// تحذير أمني: في الإنتاج يجب ضبط JWT_SECRET قوي
if (config.env === 'production' && config.jwtSecret === 'dev-insecure-secret-change-me') {
  console.error('⛔ JWT_SECRET غير مضبوط في الإنتاج! اضبط متغيّر البيئة JWT_SECRET بقيمة سرية قوية.');
}

ensureSeed(); // زرع تلقائي عند أول إقلاع لقاعدة بيانات جديدة

app.listen(config.port, () => {
  console.log(`\n🚀 PAMS يعمل على المنفذ: ${config.port}`);
  console.log(`   البيئة: ${config.env}`);
  expirePermits();
  setInterval(expirePermits, 30 * 60 * 1000); // كل نصف ساعة
  // استعادة/عرض كلمات المرور من قاعدة البيانات (عمودا password_plain و set_password)
  try { backfillPasswordPlain(); } catch (e) { console.error('تعبئة كلمات المرور:', e?.message || e); }
  setInterval(() => { try { applyPasswordResets(); } catch (e) { console.error('تطبيق كلمات المرور:', e?.message || e); } }, 20 * 1000);
  startWhatsAppAgent().catch((e) => console.error('تعذّر بدء وكيل واتساب:', e?.message || e));
  startWorker(); // طابور منصّة واتساب (لا يعمل إلا عند WA_PIPELINE_ENABLED=1)
  startHourlyExport(); // تصدير ساعي (مُطفأ ما لم تُفعّل المنصّة)
  startDistributor(); // موزّع التصاريح على المهندسين (طابور منفصل، مُطفأ ما لم تُفعّل المنصّة)
  if (config.wa.pipelineEnabled) {
    setInterval(() => { try { sweepTimedOutPackages(); } catch (e) { console.error('مسح المهلة:', e?.message || e); } }, config.wa.sweepIntervalMs);
  }
});
