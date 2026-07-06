#!/usr/bin/env node
/**
 * Database backup script
 *
 * Usage:
 *   node scripts/backup.js              → creates a backup now
 *   node scripts/backup.js --rotate     → deletes backups older than retention
 *
 * Requires `mysqldump` to be available on PATH.
 *
 * Backups are written to ./backups/db-YYYY-MM-DDTHH-mm-ss.sql.gz
 * Retention: keep the last N=14 days by default (override with BACKUP_RETENTION_DAYS env).
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import dotenv from 'dotenv';

dotenv.config();

const execFileAsync = promisify(execFile);

const BACKUPS_DIR = 'backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const ensureDir = () => {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
};

const createBackup = async () => {
  ensureDir();

  const {
    DB_HOST = '127.0.0.1',
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'mab_united_db',
  } = process.env;

  const sqlFile = path.join(BACKUPS_DIR, `db-${stamp()}.sql`);
  const gzFile = `${sqlFile}.gz`;

  console.log(`[backup] starting → ${gzFile}`);

  const args = [
    `-h${DB_HOST}`,
    `-u${DB_USER}`,
    `--single-transaction`,
    `--routines`,
    `--triggers`,
    `--default-character-set=utf8mb4`,
    DB_NAME,
  ];

  const env = { ...process.env };
  if (DB_PASSWORD) env.MYSQL_PWD = DB_PASSWORD;

  try {
    const child = execFile('mysqldump', args, { env, maxBuffer: 512 * 1024 * 1024 });
    const writeStream = fs.createWriteStream(sqlFile);
    await pipeline(child.stdout, writeStream);
    await child;

    await pipeline(
      fs.createReadStream(sqlFile),
      zlib.createGzip(),
      fs.createWriteStream(gzFile),
    );
    fs.unlinkSync(sqlFile);

    const sizeKb = (fs.statSync(gzFile).size / 1024).toFixed(1);
    console.log(`[backup] ✅ done — ${gzFile} (${sizeKb} KB)`);
  } catch (err) {
    console.error('[backup] ❌ failed:', err.message);
    if (fs.existsSync(sqlFile)) {
      try { fs.unlinkSync(sqlFile); } catch {}
    }
    process.exit(1);
  }
};

const rotateOldBackups = () => {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;
  for (const file of fs.readdirSync(BACKUPS_DIR)) {
    const full = path.join(BACKUPS_DIR, file);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        deleted += 1;
      }
    } catch {}
  }
  if (deleted > 0) console.log(`[backup] 🗑️  removed ${deleted} old backup(s) > ${RETENTION_DAYS}d`);
};

const main = async () => {
  if (process.argv.includes('--rotate')) {
    rotateOldBackups();
    return;
  }
  await createBackup();
  rotateOldBackups();
};

main().catch(err => {
  console.error('[backup] fatal:', err);
  process.exit(1);
});
