import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate, authorize('reviewer', 'support', 'general_management', 'supervisor', 'view_statistics', 'view_dashboard'));

// ملخص لوحة التحكم
router.get('/dashboard', (req, res) => {
  const byStatus = db.prepare(`SELECT status, COUNT(*) c FROM permit_requests GROUP BY status`).all();
  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.c]));

  const totals = {
    requests: db.prepare(`SELECT COUNT(*) c FROM permit_requests`).get().c,
    open: db.prepare(`SELECT COUNT(*) c FROM permit_requests WHERE status IN ('new','under_review','info_required')`).get().c,
    approvedToday: db.prepare(`SELECT COUNT(*) c FROM permit_requests WHERE status='approved' AND date(reviewed_at)=date('now')`).get().c,
    activePermits: db.prepare(`SELECT COUNT(*) c FROM permits WHERE status='active'`).get().c,
    expiringSoon: db.prepare(`SELECT COUNT(*) c FROM permits WHERE status='active' AND valid_to <= date('now','+7 day')`).get().c,
  };

  // اتجاه آخر 14 يوماً
  const trend = db.prepare(`
    SELECT date(submitted_at) d, COUNT(*) c FROM permit_requests
    WHERE submitted_at >= date('now','-13 day') GROUP BY date(submitted_at) ORDER BY d
  `).all();

  // متوسط زمن المعالجة (ساعات) للطلبات التي روجعت
  const avg = db.prepare(`
    SELECT AVG((julianday(reviewed_at)-julianday(submitted_at))*24) h
    FROM permit_requests WHERE reviewed_at IS NOT NULL
  `).get().h;

  res.json({
    byStatus: statusMap,
    totals,
    trend,
    avgProcessingHours: avg ? Number(avg.toFixed(1)) : 0,
  });
});

function scalar(sql, params = {}) {
  return db.prepare(sql).get(params)?.c || 0;
}

function topOne(sql) {
  return db.prepare(sql).get() || { label: '—', c: 0 };
}

router.get('/enterprise', (req, res) => {
  const status = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) c FROM permit_requests GROUP BY status`).all().map((r) => [r.status, r.c]));
  const totals = {
    requests: scalar(`SELECT COUNT(*) c FROM permit_requests`),
    today: scalar(`SELECT COUNT(*) c FROM permit_requests WHERE date(submitted_at)=date('now')`),
    week: scalar(`SELECT COUNT(*) c FROM permit_requests WHERE submitted_at >= datetime('now','-7 day')`),
    month: scalar(`SELECT COUNT(*) c FROM permit_requests WHERE strftime('%Y-%m', submitted_at)=strftime('%Y-%m','now')`),
    year: scalar(`SELECT COUNT(*) c FROM permit_requests WHERE strftime('%Y', submitted_at)=strftime('%Y','now')`),
    issued: scalar(`SELECT COUNT(*) c FROM permits`),
    rejected: status.rejected || 0,
    pending: scalar(`SELECT COUNT(*) c FROM permit_requests WHERE status IN ('new','under_review','info_required')`),
    activePermits: scalar(`SELECT COUNT(*) c FROM permits WHERE status='active'`),
    expiringSoon: scalar(`SELECT COUNT(*) c FROM permits WHERE status='active' AND valid_to <= date('now','+7 day')`),
  };

  const averages = db.prepare(`
    SELECT
      AVG((julianday(reviewed_at)-julianday(submitted_at))*24) review_hours,
      AVG((julianday(p.issued_at)-julianday(r.submitted_at))*24) issue_hours
    FROM permit_requests r
    LEFT JOIN permits p ON p.request_id=r.id
    WHERE r.reviewed_at IS NOT NULL OR p.issued_at IS NOT NULL
  `).get();

  const byHour = db.prepare(`
    SELECT strftime('%H', submitted_at) label, COUNT(*) c
    FROM permit_requests GROUP BY strftime('%H', submitted_at) ORDER BY label
  `).all();
  const byDay = db.prepare(`
    SELECT date(submitted_at) label, COUNT(*) c
    FROM permit_requests WHERE submitted_at >= date('now','-29 day')
    GROUP BY date(submitted_at) ORDER BY label
  `).all();
  const byRegion = db.prepare(`
    SELECT COALESCE(NULLIF(visit_location,''),'غير محدد') label, COUNT(*) c
    FROM permit_requests GROUP BY COALESCE(NULLIF(visit_location,''),'غير محدد') ORDER BY c DESC LIMIT 8
  `).all();
  const byCompany = db.prepare(`
    SELECT COALESCE(NULLIF(sponsor_company,''), CASE WHEN sponsorship='mab' THEN 'MAB' ELSE 'غير محدد' END) label, COUNT(*) c
    FROM permit_requests GROUP BY label ORDER BY c DESC LIMIT 8
  `).all();
  const bestWeek = topOne(`SELECT strftime('%Y-W%W', submitted_at) label, COUNT(*) c FROM permit_requests GROUP BY label ORDER BY c DESC LIMIT 1`);
  const bestMonth = topOne(`SELECT strftime('%Y-%m', submitted_at) label, COUNT(*) c FROM permit_requests GROUP BY label ORDER BY c DESC LIMIT 1`);
  const bestYear = topOne(`SELECT strftime('%Y', submitted_at) label, COUNT(*) c FROM permit_requests GROUP BY label ORDER BY c DESC LIMIT 1`);
  const topEngineer = topOne(`
    SELECT COALESCE(u.full_name, r.applicant_name, '—') label, COUNT(*) c
    FROM permit_requests r LEFT JOIN users u ON u.id=r.created_by
    GROUP BY r.created_by, r.applicant_name ORDER BY c DESC LIMIT 1
  `);
  const mostActiveUser = topOne(`
    SELECT COALESCE(actor_name, 'النظام') label, COUNT(*) c
    FROM audit_logs GROUP BY actor_id, actor_name ORDER BY c DESC LIMIT 1
  `);

  res.json({
    totals,
    byStatus: status,
    averages: {
      reviewHours: averages?.review_hours ? Number(averages.review_hours.toFixed(1)) : 0,
      issueHours: averages?.issue_hours ? Number(averages.issue_hours.toFixed(1)) : 0,
    },
    leaders: {
      topEngineer,
      mostActiveUser,
      topRegion: byRegion[0] || { label: '—', c: 0 },
      topCompany: byCompany[0] || { label: '—', c: 0 },
      topProject: byRegion[0] || { label: '—', c: 0 },
      bestWeek,
      bestMonth,
      bestYear,
    },
    charts: { byHour, byDay, byRegion, byCompany, byProject: byRegion },
    refreshedAt: new Date().toISOString(),
  });
});

router.get('/system-health', (req, res) => {
  const pendingJobs = db.prepare(`SELECT status, COUNT(*) c FROM wa_jobs GROUP BY status`).all();
  const deadJobs = pendingJobs.find((j) => j.status === 'dead')?.c || 0;
  res.json({
    server: { status: 'online', checkedAt: new Date().toISOString() },
    database: { status: 'online', requests: scalar(`SELECT COUNT(*) c FROM permit_requests`) },
    whatsapp: { status: pendingJobs.length ? 'queued' : 'idle', jobs: pendingJobs },
    ocr: { status: 'available' },
    queue: { status: deadJobs ? 'attention' : 'healthy', deadJobs },
    backup: { status: 'not_configured' },
  });
});

// أداء الموظفين
router.get('/officers', (req, res) => {
  const rows = db.prepare(`
    SELECT u.full_name,
      SUM(CASE WHEN h.to_status='approved' THEN 1 ELSE 0 END) approved,
      SUM(CASE WHEN h.to_status='rejected' THEN 1 ELSE 0 END) rejected,
      COUNT(*) total
    FROM status_history h JOIN users u ON u.id=h.changed_by
    WHERE h.to_status IN ('approved','rejected','info_required')
    GROUP BY h.changed_by ORDER BY total DESC
  `).all();
  res.json({ rows });
});

export default router;
