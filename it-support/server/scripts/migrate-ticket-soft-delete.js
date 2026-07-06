#!/usr/bin/env node
/**
 * One-shot migration: add soft-delete columns to Tickets table.
 * Usage:  npm run migrate:soft-delete
 */
import dotenv from 'dotenv';
dotenv.config();
import sequelize from '../config/database.js';

const COLUMNS = [
  { name: 'deletedAt', sql: 'DATETIME NULL' },
  { name: 'deletedBy', sql: 'CHAR(36) NULL' },
  { name: 'deletedByName', sql: 'VARCHAR(255) NULL' },
  { name: 'deletedByRole', sql: 'VARCHAR(50) NULL' },
  { name: 'deletionReason', sql: 'VARCHAR(255) NULL' },
];

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to DB.');

    for (const col of COLUMNS) {
      const [results] = await sequelize.query(
        `SHOW COLUMNS FROM Tickets LIKE '${col.name}'`
      );
      if (results.length > 0) {
        console.log(`⏭️  Column "${col.name}" already exists. Skipping.`);
        continue;
      }
      console.log(`⏳ Adding "${col.name}"...`);
      await sequelize.query(`ALTER TABLE Tickets ADD COLUMN ${col.name} ${col.sql}`);
      console.log(`✅ Added "${col.name}"`);
    }

    // Add index on deletedAt for faster queries
    try {
      await sequelize.query('CREATE INDEX idx_tickets_deletedAt ON Tickets(deletedAt)');
      console.log('✅ Index on deletedAt created.');
    } catch (err) {
      if (err.message.includes('Duplicate')) {
        console.log('⏭️  Index already exists.');
      } else {
        throw err;
      }
    }

    console.log('\n🎉 Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

run();
