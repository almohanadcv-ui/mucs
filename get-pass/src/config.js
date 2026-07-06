import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// مجلد التخزين الدائم (قاعدة البيانات + المرفقات) — يُضبط على القرص الدائم في الإنتاج (مثل Railway Volume)
const DATA_DIR = process.env.DATA_DIR || ROOT;

export const config = {
  root: ROOT,
  port: Number(process.env.PORT) || 4000,
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  // رابط الموقع العام (لبناء روابط الدخول المباشر التي تُرسل عبر واتساب)، مثل: https://example.com أو http://IP
  publicBaseUrl: (process.env.BASE_URL || process.env.PUBLIC_URL || '').trim().replace(/\/$/, ''),
  magicLinkDays: Number(process.env.MAGIC_LINK_DAYS) || 14, // مدة صلاحية رابط الدخول المباشر
  // التحقّق الثنائي عبر البريد (OTP) — مُطفأ ما لم يُضبط LOGIN_OTP_ENABLED=1 وبيانات SMTP
  loginOtpEnabled: process.env.LOGIN_OTP_ENABLED === '1',
  smtp: {
    host: (process.env.SMTP_HOST || '').trim(),       // مثال Hostinger: smtp.hostinger.com
    port: Number(process.env.SMTP_PORT) || 465,        // 465 (SSL) أو 587
    user: (process.env.SMTP_USER || '').trim(),        // البريد المُرسِل، مثل info@mabunited.com
    pass: process.env.SMTP_PASS || '',                 // كلمة مرور البريد
    from: (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim(),
  },
  defaultPermitDays: Number(process.env.DEFAULT_PERMIT_DAYS) || 365,
  renewalWindowDays: Number(process.env.RENEWAL_WINDOW_DAYS) || 5,
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024,
  nationalIdMode: process.env.NATIONAL_ID_MODE || 'saudi',
  // قيم ثابتة لقالب الجهة (تُطبع كما هي في ملف Excel لكل الطلبات) — عدّلها هنا عند الحاجة
  gatepass: {
    companyEmail: process.env.GATEPASS_EMAIL || 'SADEM.ALHARBI@mabunited.com',
    mobile: process.env.GATEPASS_MOBILE || '+966 50 015 0709',
    jobTitle: process.env.GATEPASS_JOBTITLE || 'Mechanical',
    city: process.env.GATEPASS_CITY || 'RIYADH',
    scopeOfWork: process.env.GATEPASS_SCOPE || 'SITE WORK',
    nationalNationality: process.env.GATEPASS_NATIONALITY || 'Saudi', // جنسية حامل الهوية الوطنية
    // مواقع الزيارة في القدية — يختار المقدّم واحداً منها (الأول هو الافتراضي)
    visitLocations: (process.env.GATEPASS_VISITS || 'WATER PARK HOTEL,GRAND HOTEL').split(',').map((s) => s.trim()).filter(Boolean),
  },
  // وكيل واتساب (المسار السريع: whatsapp-web.js) — مُطفأ افتراضياً ومعزول
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === '1',
    // أرقام مصرّح لها بالإرسال (بصيغة دولية بدون +)، مثال: 9665XXXXXXXX,9665YYYYYYYY
    allowlist: (process.env.WHATSAPP_ALLOWED || '').split(',').map((s) => s.trim().replace(/\D/g, '')).filter(Boolean),
    sessionDir: path.join(DATA_DIR, 'wa-session'),
    // إصدار تلقائي عند المطابقة + قراءة تاريخ الانتهاء (يمكن إطفاؤه بـ WHATSAPP_AUTO_ISSUE=0)
    autoIssue: (process.env.WHATSAPP_AUTO_ISSUE || '1') === '1',
    // الحساب الذي يُنسب إليه الإصدار (إن تُرك فارغاً يُختار تلقائياً مراجِع/دعم)
    issuerEmail: (process.env.WHATSAPP_ISSUER_EMAIL || '').trim().toLowerCase(),
  },
  // منصّة معالجة واتساب (الدفعة 1: الأساس) — مُطفأة افتراضياً، لا تؤثّر على أي سلوك قائم
  wa: {
    pipelineEnabled: process.env.WA_PIPELINE_ENABLED === '1',
    workerIntervalMs: Number(process.env.WA_WORKER_INTERVAL_MS) || 1500,
    // قيم قابلة للتعديل (تُستخدم في دفعات لاحقة)
    // WA_REVIEWER_NUMBER قد يحوي عدّة معرّفات مفصولة بفاصلة (الرقم + LID): الأول للإرسال، وكلّها للتعرّف على الوارد
    reviewerNumber: ((process.env.WA_REVIEWER_NUMBER || '').split(',')[0] || '').replace(/\D/g, ''),
    reviewerIds: (process.env.WA_REVIEWER_NUMBER || '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean),
    requiredDocs: (process.env.WA_REQUIRED_DOCS || 'id_image,personal_photo').split(',').map((s) => s.trim()).filter(Boolean),
    // قراءة المستندات: نموذج رؤية Claude (الأدقّ) ← OCR.space ← Google Vision ← tesseract
    anthropicApiKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
    visionModel: process.env.WA_VISION_MODEL || 'claude-haiku-4-5-20251001',
    visionApiKey: (process.env.GOOGLE_VISION_API_KEY || '').trim(),
    ocrSpaceKey: (process.env.OCRSPACE_API_KEY || '').trim(),
    ocrSpaceLang: process.env.OCRSPACE_LANG || 'eng', // 'ara' للبطاقة العربية، 'eng' لتقرير مقيم (أرقام لاتينية)
    ocrSpaceEngine: process.env.OCRSPACE_ENGINE || '2',
    ocrEngine: process.env.WA_OCR_ENGINE
      || (process.env.ANTHROPIC_API_KEY ? 'ai'
        : (process.env.OCRSPACE_API_KEY ? 'ocrspace'
          : (process.env.GOOGLE_VISION_API_KEY ? 'vision' : 'tesseract'))),
    // قراءة دقيقة متاحة؟ (يحوّل التجميع لوضع «حسب الرقم» والاكتمال لوضع الأنواع)
    accurateOcr: !!((process.env.ANTHROPIC_API_KEY || '').trim() || (process.env.OCRSPACE_API_KEY || '').trim() || (process.env.GOOGLE_VISION_API_KEY || '').trim()),
    // مطابقة الوجوه المحلية (اختياري — خلف علم؛ يحتاج face-api + نماذج)
    autoApprove: process.env.WA_AUTO_APPROVE === '1', // اعتماد المسوّدة تلقائياً (مع ضمانات)
    faceMatchEnabled: process.env.WA_FACEMATCH_ENABLED === '1',
    faceMatchThreshold: Number(process.env.WA_FACEMATCH_THRESHOLD) || 0.6, // مسافة أقل = أكثر تطابقاً (face-api)
    faceMatchMinConfidence: Number(process.env.WA_FACEMATCH_MIN_CONFIDENCE) || 88, // ثقة Claude الدنيا للمطابقة (صارمة)
    autoMatchPhotos: process.env.WA_AUTOMATCH_PHOTOS === '1', // إلحاق الصور المنفصلة بالوجه (مخاطرة دمج خاطئ — مُطفأ افتراضياً)
    faceModelsDir: process.env.WA_FACE_MODELS_DIR || path.join(ROOT, 'models', 'face'),
    batchIdleMs: Number(process.env.WA_BATCH_IDLE_MS) || 120000,
    packageTimeoutMs: Number(process.env.WA_PACKAGE_TIMEOUT_MS) || 1800000, // مهلة تجميع الحزمة (30 دقيقة)
    sweepIntervalMs: Number(process.env.WA_SWEEP_INTERVAL_MS) || 60000,       // دورية فحص المهلة
    exportIntervalMs: Number(process.env.WA_EXPORT_INTERVAL_MS) || 3600000,   // تصدير ساعي (كل ساعة)
    exportBatchSize: Number(process.env.WA_EXPORT_BATCH_SIZE) || 20,           // تصدير فوري عند تجمّع هذا العدد من الطلبات الجديدة
    distributeIntervalMs: Number(process.env.WA_DISTRIBUTE_INTERVAL_MS) || 30000, // طابور التوزيع (منفصل)
    // تحديد المعدّل المستقل لكل طابور (10 عمليات ثم انتظار 120ث افتراضياً)
    uploadRate: { count: Number(process.env.WA_UPLOAD_RATE) || 10, pauseMs: Number(process.env.WA_UPLOAD_PAUSE_MS) || 120000 },
    exportRate: { count: Number(process.env.WA_EXPORT_RATE) || 10, pauseMs: Number(process.env.WA_EXPORT_PAUSE_MS) || 120000 },
    distributionRate: { count: Number(process.env.WA_DIST_RATE) || 10, pauseMs: Number(process.env.WA_DIST_PAUSE_MS) || 120000 },
    sendRate: { count: Number(process.env.WA_SEND_RATE) || 10, pauseMs: Number(process.env.WA_SEND_PAUSE_MS) || 120000 }, // (متوافق للخلف)
  },
  paths: {
    data: path.join(DATA_DIR, 'data'),
    db: path.join(DATA_DIR, 'data', 'pams.db'),
    uploads: path.join(DATA_DIR, 'uploads'),
    public: path.join(ROOT, 'public'),
  },
};
