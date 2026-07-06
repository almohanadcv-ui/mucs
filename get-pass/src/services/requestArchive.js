import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { config } from '../config.js';

function safeName(value) {
  return String(value || 'unknown').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
}

export function archiveRequest(requestId) {
  const request = db.prepare(`SELECT * FROM permit_requests WHERE id=?`).get(requestId);
  if (!request) return null;
  const submitted = new Date((request.submitted_at || new Date().toISOString()).replace(' ', 'T') + 'Z');
  const year = String(submitted.getUTCFullYear());
  const month = String(submitted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(submitted.getUTCDate()).padStart(2, '0');
  const folderName = safeName(`${request.beneficiary_name || request.applicant_name || request.request_number} - ${request.national_id || request.request_number}`);
  const root = path.join(config.paths.data, 'Requests', year, month, day, folderName);
  const attachmentsDir = path.join(root, 'attachments');
  const logsDir = path.join(root, 'logs');
  fs.mkdirSync(attachmentsDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  const attachments = db.prepare(`SELECT * FROM attachments WHERE request_id=? ORDER BY uploaded_at`).all(requestId);
  const history = db.prepare(`SELECT * FROM status_history WHERE request_id=? ORDER BY id`).all(requestId);

  fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'metadata.json'), JSON.stringify({
    archivedAt: new Date().toISOString(),
    requestId,
    requestNumber: request.request_number,
    attachments: attachments.map((a) => ({
      id: a.id,
      fileType: a.file_type,
      originalName: a.original_name,
      storageKey: a.storage_key,
      checksum: a.checksum,
      sizeBytes: a.size_bytes,
    })),
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(logsDir, 'status-history.json'), JSON.stringify(history, null, 2), 'utf8');

  for (const att of attachments) {
    const source = path.join(config.paths.uploads, att.storage_key);
    if (!fs.existsSync(source)) continue;
    const target = path.join(attachmentsDir, `${safeName(att.file_type)}-${safeName(att.original_name)}`);
    fs.copyFileSync(source, target);
  }
  return root;
}
