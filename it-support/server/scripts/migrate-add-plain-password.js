#!/usr/bin/env node
/**
 * One-shot migration: add plainPassword column to Users table if missing.
 * Usage:   node scripts/migrate-add-plain-password.js
 */
import dotenv from 'dotenv';
dotenv.config();
import sequelize from '../config/database.js';

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB.');

    const [results] = await sequelize.query(
      `SHOW COLUMNS FROM Users LIKE 'plainPassword'`
    );

    if (results.length > 0) {
      console.log('✅ Column "plainPassword" already exists. Nothing to do.');
    } else {
      console.log('⏳ Adding "plainPassword" column...');
      await sequelize.query(
        `ALTER TABLE Users ADD COLUMN plainPassword VARCHAR(255) NULL`
      );
      console.log('✅ Column added successfully.');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

run();
