/**
 * Startup Migrations — idempotent
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 *
 * Runs on every server start. Checks if columns/indexes exist and adds
 * them ONLY if missing. Safe to run repeatedly — never destructive.
 */
import sequelize from '../config/database.js';

const ensureColumn = async (table, column, definition) => {
  const [rows] = await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
  if (rows.length > 0) return false;
  console.log(`⏳ [migration] adding ${table}.${column}`);
  await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
};

const ensureIndex = async (table, indexName, columns) => {
  const [rows] = await sequelize.query(`SHOW INDEX FROM ${table} WHERE Key_name = '${indexName}'`);
  if (rows.length > 0) return false;
  console.log(`⏳ [migration] adding index ${indexName} on ${table}`);
  await sequelize.query(`CREATE INDEX ${indexName} ON ${table}(${columns})`);
  return true;
};

export const runStartupMigrations = async () => {
  let changes = 0;
  try {
    // ─── Users: plainPassword + location ──────────────────────────
    if (await ensureColumn('Users', 'plainPassword', 'VARCHAR(255) NULL')) changes++;
    if (await ensureColumn('Users', 'location', 'VARCHAR(100) NULL')) changes++;
    if (await ensureColumn('Users', 'permissions', 'JSON NULL')) changes++;

    // One-time reset trigger:
    // If currentSessionToken column doesn't exist yet, we are about to add it
    // (so nothing to reset). If it already exists, we clear any leftover values
    // so the new "first-device-wins" rule starts from a clean slate. This is
    // safe to run repeatedly — it just nulls already-null rows.
    const addedNow = await ensureColumn('Users', 'currentSessionToken', 'VARCHAR(500) NULL');
    if (addedNow) changes++;
    if (process.env.RESET_SESSIONS_ON_BOOT === '1') {
      const [res] = await sequelize.query(
        'UPDATE Users SET currentSessionToken = NULL WHERE currentSessionToken IS NOT NULL'
      );
      const affected = res?.affectedRows ?? 0;
      if (affected > 0) {
        console.log(`🔓 [migration] cleared ${affected} stuck session(s) (RESET_SESSIONS_ON_BOOT=1)`);
        changes++;
      }
    }

    // ─── Tickets: soft-delete audit columns ──────────────────────
    if (await ensureColumn('Tickets', 'deletedAt', 'DATETIME NULL')) changes++;
    if (await ensureColumn('Tickets', 'deletedBy', 'CHAR(36) NULL')) changes++;
    if (await ensureColumn('Tickets', 'deletedByName', 'VARCHAR(255) NULL')) changes++;
    if (await ensureColumn('Tickets', 'deletedByRole', 'VARCHAR(50) NULL')) changes++;
    if (await ensureColumn('Tickets', 'deletionReason', 'VARCHAR(255) NULL')) changes++;

    // Index for fast trash queries
    if (await ensureIndex('Tickets', 'idx_tickets_deletedAt', 'deletedAt')) changes++;

    // ─── Assets: extended fields ──────────────────────────────
    // These run only if Assets table exists; safe even on first boot
    // (CREATE TABLE happens via sync() AFTER migrations).
    const [assetsTable] = await sequelize.query(`SHOW TABLES LIKE 'Assets'`);
    if (assetsTable.length > 0) {
      if (await ensureColumn('Assets', 'specifications', 'TEXT NULL')) changes++;
      if (await ensureColumn('Assets', 'assignmentDate', 'DATE NULL')) changes++;
      if (await ensureColumn('Assets', 'odooNumber', 'VARCHAR(50) NULL')) changes++;
      if (await ensureColumn('Assets', 'deviceColor', 'VARCHAR(50) NULL')) changes++;
      if (await ensureColumn('Assets', 'invoiceFile', 'VARCHAR(500) NULL')) changes++;
    }

    if (changes === 0) {
      console.log('✅ [migration] all columns/indexes already in place');
    } else {
      console.log(`✅ [migration] applied ${changes} change(s)`);
    }
  } catch (err) {
    console.error('⚠️  [migration] error (non-fatal, server will keep running):', err.message);
  }
};
