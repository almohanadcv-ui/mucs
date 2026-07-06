import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { listForUser, markRead } from '../services/notifications.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => res.json({ rows: listForUser(req.user.id) }));
router.post('/:id/read', (req, res) => {
  markRead(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

export default router;
