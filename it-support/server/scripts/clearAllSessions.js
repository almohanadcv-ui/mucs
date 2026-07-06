/**
 * One-off script: clears currentSessionToken for ALL users.
 * Use when sessions got stuck due to abnormal disconnect.
 *
 * Run on Railway:
 *   railway run node scripts/clearAllSessions.js
 *
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import sequelize from '../config/database.js';
import { User } from '../models/index.js';

const run = async () => {
  try {
    await sequelize.authenticate();
    const [result] = await sequelize.query(
      'UPDATE Users SET currentSessionToken = NULL WHERE currentSessionToken IS NOT NULL'
    );
    console.log('✅ Cleared sessions. Affected rows:', result.affectedRows ?? 'unknown');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
};

run();
