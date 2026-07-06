/*
 * whatsappAgent.js — وكيل واتساب MAB (المسار السريع: whatsapp-web.js)
 * ------------------------------------------------------------------
 * التدفّق (مطابقة + تأكيد بشري):
 *   1) يستقبل صورة/PDF من رقم مُصرّح له (allowlist).
 *   2) يستخرج رقم الهوية/الاسم (OCR) عبر permitMatcher.
 *   3) يطابق الطلب في permit_requests (قراءة).
 *   4) عند المطابقة: يُرفق الملف بالطلب + يُنبّه المراجعين + يردّ على واتساب.
 *      ❗ لا يُصدر التصريح تلقائياً — الاعتماد يبقى بيد المراجِع داخل النظام.
 *   5) عند عدم المطابقة: يردّ برسالة توضيحية.
 *
 * معزول تماماً: لا يعمل إلا عند WHATSAPP_ENABLED=1، ولا يلمس approve-issue.
 * المكتبات تُحمّل ديناميكياً حتى لا يتعطّل الخادم إن لم تُثبّت.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto, { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { notify } from './notifications.js';
import { matchPermitFile } from './permitMatcher.js';
import { issuePermitFromAgent } from './issuance.js';
import { setClient, setLastMsg } from './wa/waClient.js';
import { recordDistribution } from './wa/distributor.js';
import { resolveUserId } from './wa/linking.js';
import { enqueue } from './wa/queue.js';
import { getAllowlist, getReviewerIds } from './settings.js';
import { audit } from './audit.js';

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' };

// ردّ واحد لكل دفعة (تفادي رسالة لكل مستند)
const lastAck = new Map();
function shouldAck(id, ms = 10000) {
  const now = Date.now();
  if (now - (lastAck.get(id) || 0) > ms) { lastAck.set(id, now); return true; }
  return false;
}

function reviewerIds() {
  return db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code IN ('reviewer','support') AND u.is_active=1
  `).all().map((x) => x.id);
}

// يُرفق ملفاً بطلب موجود كـ "مستند داعم" (لا يُصدر تصريحاً)
function attachToRequest(requestId, filePath, originalName, mime) {
  const buf = fs.readFileSync(filePath);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  const id = randomUUID();
  db.prepare(`
    INSERT INTO attachments(id, request_id, file_type, original_name, storage_key, mime_type, size_bytes, checksum)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(id, requestId, 'supporting_doc', originalName, path.basename(filePath), mime, buf.length, checksum);
  return id;
}

let started = false;

export async function startWhatsAppAgent() {
  if (!config.whatsapp.enabled) {
    console.log('🟡 وكيل واتساب معطّل (اضبط WHATSAPP_ENABLED=1 لتفعيله).');
    return;
  }
  if (started) return;
  started = true;

  let WW;
  try { WW = await import('whatsapp-web.js'); }
  catch (e) { console.error('⛔ ثبّت المكتبات أولاً: npm install whatsapp-web.js qrcode-terminal —', e.message); return; }
  const { Client, LocalAuth } = WW.default || WW;
  let qrcode = null;
  try { qrcode = (await import('qrcode-terminal')).default; } catch { /* اختياري */ }

  const allow = config.whatsapp.allowlist;
  if (!allow.length) {
    console.warn('⚠️ WHATSAPP_ALLOWED فارغ — لن يعالج الوكيل أي رسالة (لأمانك). أضف أرقاماً موثوقة لتفعيل المعالجة.');
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.whatsapp.sessionDir }),
    takeoverOnConflict: true,        // لا تفقد الجلسة عند تعارض جهاز مرتبط
    takeoverTimeoutMs: 10000,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',      // الأهم: يمنع انهيار Chromium على VPS صغير الذاكرة
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    },
  });

  client.on('qr', (qr) => {
    console.log('\n📱 امسح رمز QR بهاتفك (واتساب ← الأجهزة المرتبطة) لربط الوكيل:');
    if (qrcode) qrcode.generate(qr, { small: true }); else console.log(qr);
  });
  // إعادة اتصال تلقائية: عند أي انقطاع نعيد التشغيل تلقائياً (مع مهلة متصاعدة) فلا يبقى الوكيل مطفأً
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let wasReady = false;
  function scheduleReconnect(reason) {
    setClient(null); // العميل غير متاح للإرسال الآن
    wasReady = false; // أوقف الحارس حتى يعود الاتصال
    if (reconnectTimer) return;
    const delay = Math.min(60000, 8000 * Math.pow(2, reconnectAttempts));
    reconnectAttempts++;
    console.warn(`⚠️ انقطع اتصال واتساب (${reason}) — إعادة المحاولة خلال ${Math.round(delay / 1000)}ث (محاولة ${reconnectAttempts})...`);
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try { await client.destroy().catch(() => {}); await client.initialize(); }
      catch (e) { console.error('فشل إعادة الاتصال:', e?.message || e); scheduleReconnect('init-failed'); }
    }, delay);
  }

  client.on('ready', () => { setClient(client); reconnectAttempts = 0; wasReady = true; console.log('✅ وكيل واتساب MAB جاهز ومتصل.'); });
  client.on('auth_failure', (m) => { console.error('⛔ فشل مصادقة واتساب:', m); scheduleReconnect('auth_failure'); });
  client.on('disconnected', (r) => scheduleReconnect(r));

  // حارس ذاتي (Watchdog): كل دقيقة يتحقّق من الاتصال الفعلي ويعيد الاتصال عند أي انقطاع صامت
  setInterval(async () => {
    if (!wasReady || reconnectTimer) return; // لم يكتمل الربط بعد، أو إعادة اتصال جارية
    let state = 'UNKNOWN';
    try { state = await Promise.race([client.getState(), new Promise((r) => setTimeout(() => r('TIMEOUT'), 15000))]); }
    catch { state = 'ERROR'; }
    if (state !== 'CONNECTED') {
      console.warn(`🩺 فحص الصحة: الوكيل غير متصل (${state}) — إعادة الاتصال تلقائياً...`);
      scheduleReconnect('watchdog:' + state);
    }
  }, 60 * 1000);

  client.on('message', async (msg) => {
    try {
      // استخراج رقم الهاتف الحقيقي (واتساب قد يعطي معرّف LID بدل الرقم)
      const rawFrom = String(msg.from || '').replace(/@.*$/, '').replace(/\D/g, '');
      let phone = '';
      try { const c = await msg.getContact(); phone = String(c?.number || c?.id?.user || '').replace(/\D/g, ''); } catch { /* تجاهل */ }
      if (!phone) phone = rawFrom;
      const allow = getAllowlist(); // ديناميكي (قابل للتعديل من الموقع)
      const allowed = !!allow.length && allow.some((a) => phone.endsWith(a) || rawFrom.endsWith(a));
      // إخفاء معظم الرقم في السجلّ (خصوصية)، إلا عند تفعيل WHATSAPP_DEBUG=1 لالتقاط المعرّف
      const mask = (s) => (s && s.length > 4 ? '***' + s.slice(-4) : s || '—');
      const shown = process.env.WHATSAPP_DEBUG === '1' ? phone : mask(phone);
      console.log(`📩 واتساب: رقم=${shown} | وسائط=${msg.hasMedia} | مسموح=${allowed}`);
      if (!msg.hasMedia) return;
      if (!allowed) return; // غير مصرّح → تجاهل صامت

      const media = await msg.downloadMedia();
      if (!media || !EXT[media.mimetype]) { await msg.reply('الرجاء إرسال صورة أو ملف PDF واضح للتصريح.'); return; }

      const tmp = path.join(config.paths.uploads, randomUUID() + EXT[media.mimetype]);
      fs.writeFileSync(tmp, Buffer.from(media.data, 'base64'));

      // رقم المراجِع له الأولوية المطلقة: أي ملف منه = تصريح وارد (حتى لو كان الرقم مربوطاً كمهندس أيضاً)
      // يطابق الرقم الدولي أو معرّف LID الطويل (واتساب قد يعطي أيّاً منهما)
      const revIds = getReviewerIds() || [];
      const isReviewer = revIds.some((id) => id && (phone === id || rawFrom === id || phone.endsWith(id) || rawFrom.endsWith(id) || id.endsWith(phone)));

      // توجيه حسب المُرسِل (المنصّة): رقم مهندس مربوط → مسار مستندات الهوية (مسوّدة طلب)
      if (config.wa.pipelineEnabled && !isReviewer) {
        const senderUserId = resolveUserId(phone) || resolveUserId(rawFrom);
        const senderRole = senderUserId
          ? db.prepare(`SELECT r.code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`).get(senderUserId)?.code
          : null;
        if (senderRole === 'applicant') {
          const docId = randomUUID();
          db.prepare(`INSERT INTO wa_documents(id, from_id, user_id, wa_msg_id, storage_key, mime_type, status) VALUES(?,?,?,?,?,?, 'received')`)
            .run(docId, phone || rawFrom, senderUserId, msg.id?._serialized || null, path.basename(tmp), media.mimetype);
          audit({ action: 'WA_DOC_RECEIVED', entityType: 'wa_document', entityId: docId, newValue: { user_id: senderUserId } });
          setLastMsg(senderUserId, msg.from, msg.id?._serialized); // للردّ على آخر رسالة
          enqueue('wa.doc', { documentId: docId });
          if (shouldAck(phone || rawFrom)) await msg.reply('📥 جارٍ مراجعة مستنداتك... سيصلك تقرير عند الانتهاء.');
          return;
        }
      }

      // مسار التصاريح (من المراجِع) — المنصّة: قراءة دقيقة بـClaude + إصدار + توزيع + تقرير موحّد
      if (config.wa.pipelineEnabled) {
        const sum = crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
        const dup = db.prepare(`SELECT 1 FROM attachments WHERE file_type='permit_file' AND checksum=? LIMIT 1`).get(sum);
        if (dup) {
          try { fs.existsSync(tmp) && fs.rmSync(tmp); } catch { /* تجاهل */ }
          if (shouldAck(phone || rawFrom)) await msg.reply('ℹ️ بعض التصاريح سبق إصدارها.');
          return;
        }
        const pid = randomUUID();
        db.prepare(`INSERT INTO wa_documents(id, from_id, wa_msg_id, kind, storage_key, mime_type, status) VALUES(?,?,?, 'permit', ?,?, 'received')`)
          .run(pid, phone || rawFrom, msg.id?._serialized || null, path.basename(tmp), media.mimetype);
        setLastMsg(phone || rawFrom, msg.from, msg.id?._serialized);
        enqueue('wa.permit', { documentId: pid });
        if (shouldAck(phone || rawFrom)) await msg.reply('🔎 جارٍ مراجعة التصاريح... سيصلك تقرير عند الانتهاء.');
        return;
      }

      // المسار القديم (بلا منصّة): مطابقة فورية
      const result = await matchPermitFile({ path: tmp, mimetype: media.mimetype, originalname: media.filename || ('whatsapp' + EXT[media.mimetype]) });
      if (result.matched) {
        const request = db.prepare(`SELECT * FROM permit_requests WHERE id=?`).get(result.request_id);
        const orig = media.filename || ('whatsapp-permit' + EXT[media.mimetype]);
        if (config.whatsapp.autoIssue && result.id_valid && request) {
          // تاريخ الانتهاء: من ملف التصريح إن قُرئ، وإلا من تاريخ الطلب الذي أدخله المهندس
          const validTo = result.expiry || request.doc_expiry;
          const issued = issuePermitFromAgent({ request, filePath: tmp, originalName: orig, mime: media.mimetype, validTo, source: 'whatsapp' });
          if (issued.ok) await msg.reply(`✅ تم إصدار التصريح ${issued.permitNumber} للطلب ${result.request_number}.`);
          else { try { attachToRequest(result.request_id, tmp, orig, media.mimetype); } catch { /* */ } await msg.reply(`⚠️ تعذّر الإصدار: ${issued.reason}`); }
        } else {
          try { attachToRequest(result.request_id, tmp, orig, media.mimetype); } catch { /* */ }
          for (const uid of reviewerIds()) notify({ userId: uid, reqId: result.request_id, channel: 'whatsapp', title: 'تصريح وارد', body: `الطلب ${result.request_number}` });
          await msg.reply(`✅ تم استلام الملف ومطابقته بالطلب ${result.request_number}.`);
        }
      } else {
        try { fs.existsSync(tmp) && fs.rmSync(tmp); } catch { /* تجاهل */ }
        await msg.reply('⚠️ تعذّرت مطابقة الملف بأي طلب.');
      }
    } catch (e) {
      console.error('خطأ في وكيل واتساب:', e.message);
      try { await msg.reply('حدث خطأ أثناء المعالجة. حاول مرة أخرى.'); } catch { /* تجاهل */ }
    }
  });

  client.initialize();
}
