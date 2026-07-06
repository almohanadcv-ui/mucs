import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler, httpError } from '../middleware/error.js';
import { validateNationalId } from '../utils/nationalId.js';
import { generateRequestNumber, generatePermitNumber } from '../utils/numbers.js';
import { buildXlsx } from '../utils/xlsx.js';
import { buildGatePassXlsx } from '../utils/gatepass.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';
import { getActivePermit, checkPermitBlocking, changeStatus } from '../services/workflow.js';
import { maybeAutoExport } from '../services/wa/exporter.js';
import { toISODate } from '../utils/dateNormalize.js';
import { archiveRequest } from '../services/requestArchive.js';
import { getSubmissionWindow } from '../services/settings.js';

const router = Router();
router.use(authenticate);

const onlyReviewer = authorize('reviewer');

function riyadhNow() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}

function fmt12(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const ap = h < 12 ? 'صباحاً' : 'مساءً';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ap}`;
}
function submissionWindow() {
  const now = riyadhNow();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const seconds = now.getUTCSeconds();
  const w = getSubmissionWindow();
  const START = w.startMin, END = w.endMin;
  const allowed = minutes >= START && minutes <= END;
  const untilClose = Math.max(0, ((END - minutes) * 60) - seconds);
  const untilOpen = minutes < START
    ? ((START - minutes) * 60) - seconds
    : ((24 * 60 - minutes + START) * 60) - seconds;
  return {
    allowed,
    message: `استقبال الطلبات من الساعة ${fmt12(w.start)} حتى ${fmt12(w.end)}`,
    reason: allowed ? null : (minutes < START ? 'لم يبدأ وقت استقبال الطلبات بعد.' : 'انتهى وقت استقبال الطلبات لهذا اليوم.'),
    secondsRemaining: allowed ? untilClose : untilOpen,
    start: w.start,
    end: w.end,
  };
}

function submissionGate(req, res, next) {
  const win = submissionWindow();
  if (!win.allowed) return res.status(423).json({ error: win.reason, submissionWindow: win });
  const recent = db.prepare(`
    SELECT COUNT(*) c FROM permit_requests
    WHERE created_by=? AND submitted_at >= datetime('now','-2 minutes')
  `).get(req.user.id).c;
  if (recent >= 10) return res.status(429).json({ error: 'لقد وصلت إلى الحد الأقصى. يرجى الانتظار.', retryAfterSeconds: 120 });
  next();
}

function saveAttachment(requestId, file, type) {
  const buf = fs.readFileSync(file.path);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  const attId = randomUUID();
  db.prepare(`
    INSERT INTO attachments(id, request_id, file_type, original_name, storage_key, mime_type, size_bytes, checksum)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(attId, requestId, type, file.originalname, path.basename(file.path),
    file.mimetype, file.size, checksum);
  return attId;
}

// يضمن أن الطلب "قيد المراجعة" قبل أي قرار — يعالج "جديد" و"بانتظار معلومات"
function ensureUnderReview(request, userId) {
  if (request.status === 'new' || request.status === 'info_required') {
    if (!request.assigned_to) {
      db.prepare(`UPDATE permit_requests SET assigned_to=? WHERE id=?`).run(userId, request.id);
      request.assigned_to = userId;
    }
    changeStatus({ request, toStatus: 'under_review', userId });
    request.status = 'under_review';
  }
}

function loadRequest(req) {
  const request = db.prepare(`SELECT * FROM permit_requests WHERE id=?`).get(req.params.id);
  if (!request) throw httpError(404, 'الطلب غير موجود.');
  return request;
}

function notifySupport(title, body, reqId = null) {
  const support = db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='support' AND u.is_active=1
  `).all();
  for (const s of support) notify({ userId: s.id, title, body, reqId });
}

// إشعار كل الموظفين (المراجِع + الدعم) — للطلبات الجديدة
function notifyStaff(title, body, reqId = null) {
  const staff = db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE r.code IN ('reviewer','support') AND u.is_active=1
  `).all();
  for (const s of staff) notify({ userId: s.id, title, body, reqId });
}

// ---------------------------------------------------------------
// فحص الأهلية قبل التقديم (مع دعم التجديد)
// ---------------------------------------------------------------
router.get('/eligibility/:nationalId', asyncHandler(async (req, res) => {
  const { nationalId } = req.params;
  const type = req.query.type === 'iqama' ? 'iqama' : 'national';
  const v = validateNationalId(nationalId, type);
  if (!v.valid) return res.json({ eligible: false, reason: v.message });

  const openReq = db.prepare(`
    SELECT request_number FROM permit_requests
    WHERE national_id=? AND status IN ('new','under_review','info_required') LIMIT 1
  `).get(nationalId);
  if (openReq) return res.json({ eligible: false, reason: `يوجد طلب قيد المعالجة (${openReq.request_number}) لهذه الهوية.` });

  const block = checkPermitBlocking(nationalId);
  if (block.blocked) {
    return res.json({ eligible: false,
      reason: `يوجد تصريح فعّال (${block.permit.permit_number}) ساري حتى ${block.permit.valid_to}. يمكن التجديد قبل ${config.renewalWindowDays} أيام من انتهائه.` });
  }
  if (block.renewable) {
    return res.json({ eligible: true, renewal: true,
      reason: `تجديد متاح — تصريحك الحالي ينتهي خلال ${block.daysLeft} يوم/أيام.` });
  }
  res.json({ eligible: true });
}));

router.get('/submission-window/status', authorize('applicant', 'reviewer', 'supervisor', 'create_requests'), (req, res) => {
  const recent = db.prepare(`
    SELECT COUNT(*) c FROM permit_requests
    WHERE created_by=? AND submitted_at >= datetime('now','-2 minutes')
  `).get(req.user.id).c;
  res.json({ ...submissionWindow(), spam: { limit: 10, recent, blocked: recent >= 10, retryAfterSeconds: recent >= 10 ? 120 : 0 } });
});

// ---------------------------------------------------------------
// تعبئة تلقائية: آخر بيانات معروفة لرقم الهوية
// ---------------------------------------------------------------
router.get('/lookup/:nationalId', asyncHandler(async (req, res) => {
  const nid = req.params.nationalId;
  const prev = db.prepare(`
    SELECT beneficiary_name, id_type, sponsorship, sponsor_company,
           first_name, last_name, employee_no, job_title, nationality,
           company_email, mobile, dob, address, visit_location, doc_expiry, purpose
    FROM permit_requests WHERE national_id=? ORDER BY submitted_at DESC LIMIT 1
  `).get(nid);
  const hasAtt = (type) => !!db.prepare(`
    SELECT 1 FROM attachments a JOIN permit_requests r ON r.id=a.request_id
    WHERE r.national_id=? AND a.file_type=? LIMIT 1
  `).get(nid, type);
  res.json({
    found: !!prev,
    data: prev || null,
    attachments: { id_image: hasAtt('id_image'), personal_photo: hasAtt('personal_photo'), resident_report: hasAtt('resident_report') },
  });
}));

// يعيد استخدام آخر مرفق من نوع معيّن لنفس رقم الهوية (للتجديد)
function reusePrevAttachment(newReqId, nationalId, type) {
  const att = db.prepare(`
    SELECT a.* FROM attachments a JOIN permit_requests r ON r.id=a.request_id
    WHERE r.national_id=? AND a.file_type=? ORDER BY a.uploaded_at DESC LIMIT 1
  `).get(nationalId, type);
  if (!att) return false;
  db.prepare(`
    INSERT INTO attachments(id, request_id, file_type, original_name, storage_key, mime_type, size_bytes, checksum)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(randomUUID(), newReqId, type, att.original_name, att.storage_key, att.mime_type, att.size_bytes, att.checksum);
  return true;
}
function hasPrevAttachment(nationalId, type) {
  return !!db.prepare(`
    SELECT 1 FROM attachments a JOIN permit_requests r ON r.id=a.request_id
    WHERE r.national_id=? AND a.file_type=? LIMIT 1
  `).get(nationalId, type);
}

// ---------------------------------------------------------------
// تصدير الطلبات إلى Excel (للمراجِع/الدعم)
//  mode=authority (افتراضي): ملف مبسّط للجهة المعنية + عمود الشركة عند وجود كفالة أخرى
//  mode=full: كل المعلومات بما فيها بيانات التصريح بعد الاعتماد
// ---------------------------------------------------------------
router.get('/export.xlsx', authorize('reviewer', 'support', 'general_management', 'export_excel'), asyncHandler(async (req, res) => {
  const { status, q, ids, mode } = req.query;
  const where = [];
  const params = {};
  const idList = (ids ? String(ids).split(',').map((s) => s.trim()).filter(Boolean) : []).slice(0, 1000);
  if (idList.length) {
    where.push(`r.id IN (${idList.map((_, i) => '@id' + i).join(',')})`);
    idList.forEach((v, i) => { params['id' + i] = v; });
  } else {
    if (status) { where.push('r.status=@status'); params.status = status; }
    if (q) { where.push('(r.request_number LIKE @q OR r.national_id LIKE @q OR r.beneficiary_name LIKE @q)'); params.q = `%${q}%`; }
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT r.*, p.permit_number, p.valid_from, p.valid_to, p.status AS permit_status
    FROM permit_requests r
    LEFT JOIN permits p ON p.request_id = r.id AND p.status IN ('active','expired')
    ${whereSql} ORDER BY r.submitted_at DESC
  `).all(params);

  const ST = { new: 'New', under_review: 'Under Review', info_required: 'Info Required',
    approved: 'Approved', rejected: 'Rejected', expired: 'Expired', cancelled: 'Cancelled' };
  const docType = (r) => (r.id_type === 'iqama' ? 'Iqama' : 'National ID');
  const sponsor = (r) => (r.sponsorship === 'other' ? 'Other Company' : 'MAB');

  // mode=full: كل المعلومات الداخلية (تقرير إداري) — يبقى بالشكل البسيط
  if (mode === 'full') {
    const data = [[
      'Request No', 'Document Type', 'ID / Iqama No', 'Beneficiary Name', 'Applicant',
      'Sponsorship', 'Company Name', 'Purpose', 'Status', 'Submitted On',
      'Permit No', 'Valid From', 'Valid To',
    ]];
    for (const r of rows) data.push([
      r.request_number, docType(r), r.national_id, r.beneficiary_name || '', r.applicant_name || '',
      sponsor(r), r.sponsor_company || '', r.purpose || '', ST[r.status] || r.status,
      (r.submitted_at || '').slice(0, 16),
      r.permit_number || '', r.valid_from || '', r.valid_to || '',
    ]);
    const widths = [18, 14, 16, 26, 22, 14, 24, 34, 14, 18, 18, 14, 14];
    const buf = buildXlsx(data, 'Requests-Full', widths);
    const fname = `requests-full-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(buf);
  }

  // عند التصدير للجهة: حوّل الطلبات "الجديدة" المُصدَّرة إلى "قيد المراجعة" تلقائياً
  const newOnes = rows.filter((r) => r.status === 'new');
  if (newOnes.length) {
    const exporter = req.user.id;
    const tx = db.transaction(() => {
      for (const r of newOnes) {
        const reqRow = db.prepare(`SELECT * FROM permit_requests WHERE id=?`).get(r.id);
        if (reqRow && reqRow.status === 'new') {
          if (!reqRow.assigned_to) db.prepare(`UPDATE permit_requests SET assigned_to=? WHERE id=?`).run(exporter, reqRow.id);
          changeStatus({ request: reqRow, toStatus: 'under_review', reason: 'تم التصدير للجهة المعنية', userId: exporter });
          db.prepare(`UPDATE permit_requests SET exported_at=datetime('now') WHERE id=?`).run(reqRow.id);
        }
      }
    });
    tx();
    audit({ req, action: 'EXPORT_TO_AUTHORITY', entityType: 'request', newValue: { moved_to_review: newOnes.length } });
  }

  // mode=authority (افتراضي): قالب الجهة الرسمي (Qiddiya gate pass) — منطق مشترك
  const buf = buildGatePassXlsx(rows);
  const fname = `gatepass-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(buf);
}));

// ---------------------------------------------------------------
// إنشاء طلب جديد (مقدم الطلب، والمشرف عند الحاجة لتغطية إجازات مقدمي الطلب)
// ---------------------------------------------------------------
router.post('/', authorize('applicant', 'supervisor', 'create_requests'), submissionGate, upload.fields([
  { name: 'id_image', maxCount: 1 },
  { name: 'personal_photo', maxCount: 1 },
  { name: 'resident_report', maxCount: 1 },
  { name: 'documents', maxCount: 5 },
]), asyncHandler(async (req, res) => {
  const cleanup = () => {
    for (const list of Object.values(req.files || {}))
      for (const f of list) fs.existsSync(f.path) && fs.rmSync(f.path);
  };
  try {
    const national_id = req.body.national_id;
    const isRenewal = String(req.body.renewal) === 'true';

    const t = (x) => (x == null ? '' : String(x).trim());
    let idType = req.body.id_type === 'iqama' ? 'iqama' : 'national';
    let purpose = t(req.body.purpose); // اختياري — يظهر خارج الجدول في Excel
    let sponsorship = req.body.sponsorship === 'other' ? 'other' : 'mab';
    let sponsorCompany = sponsorship === 'other' ? (req.body.sponsor_company || '').trim() : null; // غير إلزامي

    // موقع الزيارة: اختيار من القائمة المعتمدة (وإلا الافتراضي)
    const VISITS = config.gatepass.visitLocations;
    const pickVisit = (val) => (VISITS.includes(t(val)) ? t(val) : VISITS[0]);

    // حقول قالب الجهة — معظمها ثابت، والمتغيّر: الاسم، الجنسية (للإقامة)، الميلاد، موقع الزيارة
    let f = {
      first_name: t(req.body.first_name),
      last_name: t(req.body.last_name),
      employee_no: t(req.body.employee_no),
      job_title: config.gatepass.jobTitle,            // ثابت Mechanical
      nationality: idType === 'national' ? config.gatepass.nationalNationality : t(req.body.nationality),
      company_email: config.gatepass.companyEmail,    // ثابت
      mobile: config.gatepass.mobile,                 // ثابت
      dob: toISODate(t(req.body.dob)) || t(req.body.dob),
      doc_expiry: toISODate(t(req.body.doc_expiry)),  // تاريخ نهاية الهوية/الإقامة (إجباري) — يُطبّع لـISO
      address: config.gatepass.city,                  // ثابت RIYADH
      visit_location: pickVisit(req.body.visit_location),
    };

    // عند التجديد: نجلب بيانات الشخص من آخر طلب سابق لنفس الهوية (المقدّم يُدخل رقم الهوية فقط)
    let prev = null;
    if (isRenewal) {
      prev = db.prepare(`SELECT * FROM permit_requests WHERE national_id=? ORDER BY submitted_at DESC LIMIT 1`).get(national_id);
      if (!prev) throw httpError(400, 'لا يوجد طلب سابق لهذه الهوية حتى تتمكن من التجديد.');
      idType = prev.id_type;
      sponsorship = prev.sponsorship;
      sponsorCompany = prev.sponsor_company;
      purpose = t(req.body.purpose) || (prev.purpose || '');
      f = {
        first_name: prev.first_name || '', last_name: prev.last_name || '',
        employee_no: prev.employee_no || '',
        job_title: config.gatepass.jobTitle,
        nationality: idType === 'national' ? config.gatepass.nationalNationality : (prev.nationality || ''),
        company_email: config.gatepass.companyEmail,
        mobile: config.gatepass.mobile,
        dob: prev.dob || '',
        doc_expiry: toISODate(t(req.body.doc_expiry)) || (prev.doc_expiry || ''),
        address: config.gatepass.city,
        visit_location: pickVisit(prev.visit_location),
      };
    }

    const beneficiary_name = `${f.first_name} ${f.last_name}`.trim();

    const v = validateNationalId(national_id, idType);
    if (!v.valid) throw httpError(400, v.message);
    const engName = (s) => /^[A-Za-z][A-Za-z .'-]*$/.test(s);
    if (!isRenewal) {
      if (!f.first_name) throw httpError(400, 'الاسم الأول مطلوب.');
      if (!f.last_name) throw httpError(400, 'اسم العائلة مطلوب.');
      if (!engName(f.first_name) || !engName(f.last_name))
        throw httpError(400, 'الاسم يجب أن يكون بالإنجليزية فقط (English letters only).');
      // الجنسية إلزامية للإقامة فقط (وبالإنجليزية)
      if (idType === 'iqama') {
        if (!f.nationality) throw httpError(400, 'الجنسية مطلوبة (Nationality).');
        if (!engName(f.nationality)) throw httpError(400, 'الجنسية يجب أن تكون بالإنجليزية فقط.');
      }
      if (!f.doc_expiry) throw httpError(400, idType === 'iqama' ? 'تاريخ نهاية الإقامة مطلوب.' : 'تاريخ نهاية الهوية مطلوب.');
    }
    // الغرض/السبب اختياري، واسم الشركة الكفيلة اختياري — لا تحقّق إلزامي عليهما

    // ===== منع التكرار الصارم: تصريح/طلب واحد فقط لكل رقم هوية =====
    const block = checkPermitBlocking(national_id);
    if (block.permit) {
      if (block.blocked)
        throw httpError(409, `ممنوع: يوجد تصريح فعّال (${block.permit.permit_number}) لهذه الهوية ساري حتى ${block.permit.valid_to}.`);
      // يوجد تصريح ضمن نافذة التجديد — يُسمح فقط عبر مسار التجديد
      if (block.renewable && !isRenewal)
        throw httpError(409, 'يوجد تصريح فعّال لهذه الهوية. استخدم زر «تجديد» من صفحة «طلباتي» أو من اللافتة أعلى الصفحة.');
    }
    const openReq = db.prepare(`
      SELECT request_number FROM permit_requests
      WHERE national_id=? AND status IN ('new','under_review','info_required') LIMIT 1
    `).get(national_id);
    if (openReq) throw httpError(409, `ممنوع: يوجد طلب قيد المعالجة بالفعل (${openReq.request_number}) لهذه الهوية.`);

    const idImage = req.files?.id_image?.[0];
    const personalPhoto = req.files?.personal_photo?.[0];
    const residentReport = req.files?.resident_report?.[0];
    if (isRenewal) {
      // التجديد: يُعاد استخدام المستندات السابقة — لا حاجة لرفع جديد
      if (!hasPrevAttachment(national_id, 'id_image') || !hasPrevAttachment(national_id, 'personal_photo'))
        throw httpError(400, 'لا توجد مستندات سابقة لإعادة استخدامها. قدّم طلباً جديداً كاملاً.');
    } else {
      if (!idImage) throw httpError(400, 'صورة الهوية / الإقامة مطلوبة.');
      if (!personalPhoto) throw httpError(400, 'الصورة الشخصية مطلوبة.');
      if (idType === 'iqama' && !residentReport) throw httpError(400, 'تقرير المقيم مطلوب للإقامة.');
    }

    const id = randomUUID();
    const requestNumber = generateRequestNumber();
    const applicantName = req.user.full_name; // ثابت = اسم الحساب

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO permit_requests
          (id, request_number, national_id, id_type, applicant_name, beneficiary_name,
           sponsorship, sponsor_company, purpose, priority, status, created_by,
           first_name, last_name, employee_no, job_title, nationality, company_email, mobile, dob, address, visit_location, doc_expiry)
        VALUES(?,?,?,?,?,?,?,?,?, 'normal', 'new', ?, ?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, requestNumber, national_id, idType, applicantName, beneficiary_name,
        sponsorship, sponsorCompany, purpose.trim(), req.user.id,
        f.first_name, f.last_name, f.employee_no, f.job_title, f.nationality,
        f.company_email, f.mobile, f.dob, f.address, f.visit_location, f.doc_expiry);

      db.prepare(`INSERT INTO status_history(request_id, from_status, to_status, changed_by)
                  VALUES(?, NULL, 'new', ?)`).run(id, req.user.id);

      if (isRenewal) {
        reusePrevAttachment(id, national_id, 'id_image');
        reusePrevAttachment(id, national_id, 'personal_photo');
        if (idType === 'iqama') reusePrevAttachment(id, national_id, 'resident_report');
      } else {
        saveAttachment(id, idImage, 'id_image');
        saveAttachment(id, personalPhoto, 'personal_photo');
        if (residentReport) saveAttachment(id, residentReport, 'resident_report');
      }
      for (const doc of req.files?.documents || []) saveAttachment(id, doc, 'supporting_doc');
    });
    tx();

    audit({ req, action: 'CREATE', entityType: 'request', entityId: id,
      newValue: { request_number: requestNumber, national_id, id_type: idType, renewal: !!block.renewable } });
    notify({ userId: req.user.id, reqId: id, title: 'تم استلام طلبك', body: `رقم الطلب ${requestNumber}` });
    notifyStaff('طلب تصريح جديد', `${requestNumber} — ${beneficiary_name.trim()}`, id);
    try { archiveRequest(id); } catch (e) { console.error('أرشفة الطلب:', e?.message || e); }

    // التصدير للمراجِع يتم تلقائياً بعد إغلاق وقت الاستقبال (لا عتبة عدد).

    res.status(201).json({ id, request_number: requestNumber, status: 'new' });
  } catch (err) {
    cleanup();
    throw err;
  }
}));

// ---------------------------------------------------------------
// قائمة الطلبات
// ---------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const { status, q, page = 1, pageSize = 20 } = req.query;
  const where = [];
  const params = {};
  if (req.user.role === 'applicant') { where.push('created_by = @uid'); params.uid = req.user.id; }
  if (status) { where.push('status = @status'); params.status = status; }
  if (q) { where.push('(request_number LIKE @q OR national_id LIKE @q OR beneficiary_name LIKE @q OR applicant_name LIKE @q)'); params.q = `%${q}%`; }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM permit_requests ${whereSql}`).get(params).c;
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page), 1) - 1) * limit;

  const rows = db.prepare(`
    SELECT r.*, u.full_name AS assigned_name,
      (SELECT COUNT(*) FROM attachments a WHERE a.request_id=r.id) AS attachment_count
    FROM permit_requests r
    LEFT JOIN users u ON u.id = r.assigned_to
    ${whereSql}
    ORDER BY r.submitted_at DESC, r.rowid DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ total, page: Number(page), pageSize: limit, rows });
}));

// تفاصيل طلب
router.get('/:id', asyncHandler(async (req, res) => {
  const request = db.prepare(`
    SELECT r.*, u.full_name AS assigned_name FROM permit_requests r
    LEFT JOIN users u ON u.id=r.assigned_to WHERE r.id=?
  `).get(req.params.id);
  if (!request) throw httpError(404, 'الطلب غير موجود.');
  if (req.user.role === 'applicant' && request.created_by !== req.user.id)
    throw httpError(403, 'لا تملك صلاحية عرض هذا الطلب.');

  const attachments = db.prepare(
    `SELECT id, file_type, original_name, mime_type, size_bytes, uploaded_at FROM attachments WHERE request_id=? ORDER BY uploaded_at`
  ).all(request.id);
  const history = db.prepare(`
    SELECT h.*, u.full_name AS changed_by_name FROM status_history h
    LEFT JOIN users u ON u.id=h.changed_by WHERE h.request_id=? ORDER BY h.id ASC
  `).all(request.id);
  const permit = db.prepare(`SELECT * FROM permits WHERE request_id=? ORDER BY issued_at DESC LIMIT 1`).get(request.id);

  res.json({ request, attachments, history, permit });
}));

// عرض/تنزيل مرفق (للمعاينة inline)
router.get('/:id/attachments/:attId', asyncHandler(async (req, res) => {
  const request = db.prepare(`SELECT created_by FROM permit_requests WHERE id=?`).get(req.params.id);
  if (!request) throw httpError(404, 'الطلب غير موجود.');
  if (req.user.role === 'applicant' && request.created_by !== req.user.id)
    throw httpError(403, 'غير مصرّح.');
  const att = db.prepare(`SELECT * FROM attachments WHERE id=? AND request_id=?`).get(req.params.attId, req.params.id);
  if (!att) throw httpError(404, 'المرفق غير موجود.');
  const filePath = path.join(config.paths.uploads, att.storage_key);
  if (!fs.existsSync(filePath)) throw httpError(404, 'الملف غير موجود على الخادم.');
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(att.original_name)}"`);
  fs.createReadStream(filePath).pipe(res);
}));

// ---------------------------------------------------------------
// إجراءات المراجِع
// ---------------------------------------------------------------

// ترك الطلب
router.post('/:id/release', onlyReviewer, asyncHandler(async (req, res) => {
  const request = loadRequest(req);
  db.prepare(`UPDATE permit_requests SET assigned_to=NULL, status='new', updated_at=datetime('now') WHERE id=?`).run(request.id);
  db.prepare(`INSERT INTO status_history(request_id, from_status, to_status, reason, changed_by)
              VALUES(?,?, 'new', 'تم ترك الطلب وإعادته للطابور', ?)`).run(request.id, request.status, req.user.id);
  audit({ req, action: 'RELEASE', entityType: 'request', entityId: request.id });
  res.json({ ok: true });
}));

// طلب معلومات
router.post('/:id/request-info', onlyReviewer, asyncHandler(async (req, res) => {
  const request = loadRequest(req);
  const reason = req.body.reason?.trim();
  if (!reason) throw httpError(400, 'يجب توضيح المعلومات المطلوبة.');
  ensureUnderReview(request, req.user.id);
  changeStatus({ request, toStatus: 'info_required', reason, userId: req.user.id });
  audit({ req, action: 'REQUEST_INFO', entityType: 'request', entityId: request.id, newValue: { reason } });
  notify({ userId: request.created_by, reqId: request.id, title: 'مطلوب معلومات إضافية', body: `${request.request_number}: ${reason}` });
  res.json({ ok: true });
}));

// رفض
router.post('/:id/reject', onlyReviewer, asyncHandler(async (req, res) => {
  const request = loadRequest(req);
  const reason = req.body.reason?.trim();
  if (!reason) throw httpError(400, 'سبب الرفض مطلوب.');
  ensureUnderReview(request, req.user.id);
  changeStatus({ request, toStatus: 'rejected', reason, userId: req.user.id });
  audit({ req, action: 'REJECT', entityType: 'request', entityId: request.id, newValue: { reason } });
  notify({ userId: request.created_by, reqId: request.id, title: 'تم رفض طلبك', body: `${request.request_number}: ${reason}` });
  res.json({ ok: true });
}));

// بدء المراجعة يدوياً (اختياري)
router.post('/:id/start-review', onlyReviewer, asyncHandler(async (req, res) => {
  const request = loadRequest(req);
  ensureUnderReview(request, req.user.id);
  audit({ req, action: 'START_REVIEW', entityType: 'request', entityId: request.id });
  res.json({ ok: true });
}));

// اعتماد + إصدار التصريح (خطوة واحدة بتاريخ بداية ونهاية + رفع ملف التصريح الرسمي اختيارياً)
router.post('/:id/approve-issue', onlyReviewer, upload.fields([{ name: 'permit_file', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const cleanup = () => {
      for (const list of Object.values(req.files || {}))
        for (const f of list) fs.existsSync(f.path) && fs.rmSync(f.path);
    };
    try {
      const request = loadRequest(req);
      if (['rejected', 'cancelled', 'expired'].includes(request.status))
        throw httpError(409, 'لا يمكن اعتماد طلب منتهٍ أو مرفوض.');

      const from = req.body.valid_from || new Date().toISOString().slice(0, 10);
      let to = req.body.valid_to;
      if (!to) { const d = new Date(from); d.setDate(d.getDate() + config.defaultPermitDays); to = d.toISOString().slice(0, 10); }
      if (to <= from) throw httpError(400, 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.');

      const permitFile = req.files?.permit_file?.[0];
      if (!permitFile) throw httpError(400, 'يجب إرفاق ملف التصريح الرسمي (صورة أو PDF) لاعتماد الطلب.');

      const permitId = randomUUID();
      const permitNumber = generatePermitNumber();
      const verifyToken = randomUUID().replace(/-/g, '');
      const holder = request.beneficiary_name || request.applicant_name;

      const tx = db.transaction(() => {
        ensureUnderReview(request, req.user.id);
        changeStatus({ request, toStatus: 'approved', userId: req.user.id });
        const old = getActivePermit(request.national_id);
        if (old) db.prepare(`UPDATE permits SET status='expired' WHERE id=?`).run(old.id);
        const fileId = saveAttachment(request.id, permitFile, 'permit_file');
        db.prepare(`
          INSERT INTO permits(id, permit_number, request_id, national_id, holder_name,
                              status, valid_from, valid_to, issued_by, verify_token, permit_file_id)
          VALUES(?,?,?,?,?, 'active', ?,?,?,?,?)
        `).run(permitId, permitNumber, request.id, request.national_id, holder, from, to, req.user.id, verifyToken, fileId);
      });
      try { tx(); }
      catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw httpError(409, 'يوجد تصريح فعّال بالفعل لهذه الهوية.');
        throw err;
      }

      audit({ req, action: 'APPROVE_ISSUE', entityType: 'permit', entityId: permitId,
        newValue: { permit_number: permitNumber, national_id: request.national_id, valid_from: from, valid_to: to } });
      notify({ userId: request.created_by, reqId: request.id, title: 'تم اعتماد وإصدار تصريحك', body: `${permitNumber} ساري حتى ${to}` });
      notifySupport('تم اعتماد طلب وإصدار تصريح', `${request.request_number} → ${permitNumber} (بواسطة ${req.user.full_name})`, request.id);

      res.status(201).json({ ok: true, permit_id: permitId, permit_number: permitNumber, valid_from: from, valid_to: to });
    } catch (err) { cleanup(); throw err; }
  }));

// ---------------------------------------------------------------
// رد المقدّم على طلب المعلومات
// ---------------------------------------------------------------
router.post('/:id/respond', upload.fields([{ name: 'documents', maxCount: 5 }]),
  asyncHandler(async (req, res) => {
    const cleanup = () => {
      for (const list of Object.values(req.files || {}))
        for (const f of list) fs.existsSync(f.path) && fs.rmSync(f.path);
    };
    try {
      const request = loadRequest(req);
      if (request.created_by !== req.user.id) throw httpError(403, 'لا تملك صلاحية الرد على هذا الطلب.');
      if (request.status !== 'info_required') throw httpError(409, 'لا يمكن الرد إلا على طلب بانتظار معلومات.');
      const response = req.body.response?.trim();
      if (!response && !(req.files?.documents?.length)) throw httpError(400, 'أدخل المعلومات المطلوبة أو أرفق ملفاً.');

      const tx = db.transaction(() => {
        for (const doc of req.files?.documents || []) saveAttachment(request.id, doc, 'supporting_doc');
        changeStatus({ request, toStatus: 'under_review', reason: response || 'تم إرفاق المستندات المطلوبة', userId: req.user.id });
      });
      tx();

      audit({ req, action: 'RESPOND_INFO', entityType: 'request', entityId: request.id, newValue: { response } });
      if (request.assigned_to) notify({ userId: request.assigned_to, reqId: request.id, title: 'تم استلام رد المقدّم', body: `${request.request_number} عاد للمراجعة.` });
      res.json({ ok: true });
    } catch (err) { cleanup(); throw err; }
  }));

export default router;
