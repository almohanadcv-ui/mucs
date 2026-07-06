/*
 * faceMatch.js — مطابقة وجوه محلية (اختياري، خلف WA_FACEMATCH_ENABLED)
 * -------------------------------------------------------------------
 * يقارن وجه الصورة الشخصية بوجه الهوية ويُنبّه المراجِع عند الاختلاف.
 * يحمّل المكتبات الثقيلة (face-api/tfjs/canvas) ديناميكياً عند أول استخدام فقط،
 * فإن لم تكن مثبّتة لا يتعطّل الخادم — تُسجَّل المهمة فاشلة وتُكمل البقية.
 * القرار النهائي يبقى للمراجِع؛ هذه إشارة مساعِدة فقط.
 */
import path from 'node:path';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { audit } from '../audit.js';
import { notify } from '../notifications.js';
import { registerHandler } from './queue.js';
import { autoApprovePackage } from './requestCreator.js';

let loaded = false;
let faceapi = null;
let canvasLib = null;

async function ensureLoaded() {
  if (loaded) return;
  await import('@tensorflow/tfjs-node'); // تسجيل خلفية tf الأصلية
  const fa = await import('@vladmandic/face-api');
  faceapi = fa.default || fa;
  const c = await import('canvas');
  canvasLib = c.default || c;
  const { Canvas, Image, ImageData } = canvasLib;
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
  const dir = config.wa.faceModelsDir;
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(dir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(dir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(dir);
  loaded = true;
  console.log('✅ نماذج مطابقة الوجوه مُحمّلة.');
}

// يكتشف كل الوجوه ويختار الأكبر (مناسب للهوية ذات الوجه الصغير وسط نص)؛ minConfidence أقل = حساسية أعلى
async function descriptorOf(filePath, minConfidence = 0.5) {
  const img = await canvasLib.loadImage(filePath);
  const opts = new faceapi.SsdMobilenetv1Options({ minConfidence });
  const dets = await faceapi.detectAllFaces(img, opts).withFaceLandmarks().withFaceDescriptors();
  if (!dets.length) return null;
  dets.sort((a, b) => (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height));
  return dets[0].descriptor;
}

/** يقارن وجهين. @returns {{ok:boolean, distance?:number, match?:boolean, reason?:string}} */
export async function compareFaces(idPath, photoPath) {
  await ensureLoaded();
  const d1 = await descriptorOf(idPath, 0.2);   // الهوية: حساسية أعلى لالتقاط الوجه الصغير
  if (!d1) return { ok: false, reason: 'لم يُكتشف وجه في صورة الهوية' };
  const d2 = await descriptorOf(photoPath, 0.4);
  if (!d2) return { ok: false, reason: 'لم يُكتشف وجه في الصورة الشخصية' };
  const distance = faceapi.euclideanDistance(d1, d2);
  return { ok: true, distance, match: distance < config.wa.faceMatchThreshold };
}

// واصف وجه صورة (لمطابقة الدفعة) — null إن لم يُكتشف وجه
export async function faceDescriptor(filePath, minConfidence = 0.2) {
  await ensureLoaded();
  return descriptorOf(filePath, minConfidence);
}
export function descriptorDistance(a, b) { return faceapi.euclideanDistance(a, b); }

function reviewerIds() {
  return db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code IN ('reviewer','support') AND u.is_active=1`).all().map((x) => x.id);
}

// معالِج طابور المطابقة (يُشغَّل عند جاهزية الحزمة إن كان مفعّلاً)
registerHandler('wa.facematch', async (payload) => {
  if (!config.wa.faceMatchEnabled) return;
  const pkg = db.prepare(`SELECT * FROM wa_packages WHERE id=?`).get(payload.packageId);
  if (!pkg) return;
  const idDoc = db.prepare(`SELECT storage_key FROM wa_documents WHERE package_id=? AND kind IN ('national','iqama') ORDER BY confidence DESC LIMIT 1`).get(pkg.id);
  const photoDoc = db.prepare(`SELECT storage_key FROM wa_documents WHERE package_id=? AND kind='personal_photo' LIMIT 1`).get(pkg.id);
  if (!idDoc || !photoDoc) return;

  const idPath = path.join(config.paths.uploads, idDoc.storage_key);
  const photoPath = path.join(config.paths.uploads, photoDoc.storage_key);
  // لا ندع فشل الفحص (نموذج/ذاكرة) يبتلع المسوّدة — نعامله كـ«تعذّر التحقّق» ونُكمل
  let r;
  try { r = await compareFaces(idPath, photoPath); }
  catch (e) { console.error('خطأ فحص الوجه:', e?.message || e); r = { ok: false, reason: 'خطأ الفحص: ' + (e?.message || e) }; }

  // 1) سطر نتيجة الوجه + تخزين
  let faceLine;
  if (!r.ok) {
    db.prepare(`UPDATE wa_packages SET face_match=NULL WHERE id=?`).run(pkg.id);
    audit({ action: 'FACE_MATCH', entityType: 'wa_package', entityId: pkg.id, newValue: { ok: false, reason: r.reason } });
    faceLine = `⚠️ تعذّر التحقّق من الوجه (${r.reason})`;
  } else {
    db.prepare(`UPDATE wa_packages SET face_match=?, face_distance=? WHERE id=?`).run(r.match ? 1 : 0, r.distance, pkg.id);
    audit({ action: 'FACE_MATCH', entityType: 'wa_package', entityId: pkg.id, newValue: { match: r.match, distance: Number(r.distance.toFixed(3)) } });
    faceLine = r.match
      ? `✅ الوجه مطابق (تشابه ${r.distance.toFixed(2)})`
      : `⛔ الوجه لا يطابق (تشابه ${r.distance.toFixed(2)} / الحدّ ${config.wa.faceMatchThreshold})`;
  }

  // 2) الاعتماد التلقائي فقط عند تطابق مؤكّد
  let statusLine = 'الحالة: بانتظار قرارك (YES لإنشاء الطلب، NO للرفض).';
  if (config.wa.autoApprove && r.ok && r.match) {
    const res = autoApprovePackage(pkg.id);
    statusLine = res.ok ? `الحالة: ✅ اعتُمد تلقائياً — الطلب ${res.request_number}` : `الحالة: ⚠️ تعذّر الاعتماد التلقائي (${res.reason})`;
  }

  // 3) رسالة واحدة موحّدة للمراجِع بعد التحقّق
  const eng = pkg.user_id ? (db.prepare(`SELECT full_name FROM users WHERE id=?`).get(pkg.user_id)?.full_name || '—') : '—';
  const idType = db.prepare(`SELECT kind FROM wa_documents WHERE package_id=? AND kind IN ('national','iqama') LIMIT 1`).get(pkg.id)?.kind === 'iqama' ? 'إقامة' : 'هوية وطنية';
  const body = [
    `📋 نتيجة فحص مستندات المهندس: ${eng}`,
    `النوع: ${idType} | الرقم: ${pkg.national_id || '—'}`,
    faceLine,
    statusLine,
    `رقم الحزمة: ${pkg.id}`,
  ].join('\n');
  for (const uid of reviewerIds()) notify({ userId: uid, channel: 'whatsapp', title: 'نتيجة فحص مسوّدة (واتساب)', body });
});
