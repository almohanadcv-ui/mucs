import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { verifyAuditChain } from '../services/audit.js';

const router = Router();
router.use(authenticate, authorize('support', 'view_audit_logs'));

// سجل التدقيق مع تصفية
router.get('/', (req, res) => {
  const { action, entity_type, q, page = 1, pageSize = 50 } = req.query;
  const where = [];
  const params = {};
  if (action) { where.push('action=@action'); params.action = action; }
  if (entity_type) { where.push('entity_type=@entity_type'); params.entity_type = entity_type; }
  if (q) { where.push('(actor_name LIKE @q OR entity_id LIKE @q)'); params.q = `%${q}%`; }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) c FROM audit_logs ${whereSql}`).get(params).c;
  const limit = Math.min(Number(pageSize) || 50, 200);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  const rows = db.prepare(`
    SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });
  res.json({ total, rows });
});

// التحقق من سلامة سلسلة التجزئة
router.get('/integrity', (req, res) => res.json(verifyAuditChain()));

export default router;
