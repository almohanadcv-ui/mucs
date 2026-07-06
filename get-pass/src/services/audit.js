import crypto from 'node:crypto';
import { db } from '../db/index.js';

const getLast = db.prepare(`SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1`);
const insert = db.prepare(`
  INSERT INTO audit_logs(actor_id, actor_name, action, entity_type, entity_id,
                         old_value, new_value, ip_address, user_agent, prev_hash, hash)
  VALUES(@actor_id,@actor_name,@action,@entity_type,@entity_id,
         @old_value,@new_value,@ip_address,@user_agent,@prev_hash,@hash)
`);

/**
 * يسجّل حدثاً في سجل التدقيق مع سلسلة تجزئة (tamper-evident).
 */
export function audit({ req, actor, action, entityType, entityId, oldValue, newValue }) {
  const actorId = actor?.id ?? req?.user?.id ?? null;
  const actorName = actor?.full_name ?? req?.user?.full_name ?? 'النظام';
  const prevHash = getLast.get()?.hash || 'GENESIS';

  const payload = {
    actor_id: actorId,
    actor_name: actorName,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    old_value: oldValue ? JSON.stringify(oldValue) : null,
    new_value: newValue ? JSON.stringify(newValue) : null,
    ip_address: req?.ip || null,
    user_agent: req?.headers?.['user-agent'] || null,
    prev_hash: prevHash,
  };

  const hash = crypto
    .createHash('sha256')
    .update(prevHash + JSON.stringify(payload) + new Date().toISOString())
    .digest('hex');

  insert.run({ ...payload, hash });
}

/** التحقق من سلامة سلسلة سجل التدقيق. */
export function verifyAuditChain() {
  const rows = db.prepare(`SELECT id, prev_hash, hash FROM audit_logs ORDER BY id ASC`).all();
  let expectedPrev = 'GENESIS';
  for (const row of rows) {
    if (row.prev_hash !== expectedPrev) {
      return { intact: false, brokenAt: row.id };
    }
    expectedPrev = row.hash;
  }
  return { intact: true, count: rows.length };
}
