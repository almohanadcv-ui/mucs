import mysql2 from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function fixDatabase() {
  const conn = await mysql2.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'mab_united_db',
  });

  console.log('Connected to MySQL ✅');
  const db = process.env.DB_NAME || 'mab_united_db';

  try {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0;');
    console.log('Foreign key checks disabled');

    // --- Drop ALL foreign keys on dependent tables ---
    const tables = ['Replies', 'Attachments', 'Notifications'];
    for (const tbl of tables) {
      const [fks] = await conn.execute(`
        SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = '${tbl}' AND TABLE_SCHEMA = '${db}'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of fks) {
        try {
          await conn.execute(`ALTER TABLE \`${tbl}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          console.log(`Dropped FK ${tbl}: ${fk.CONSTRAINT_NAME}`);
        } catch (e) {
          console.log(`Skip: ${e.message}`);
        }
      }
    }

    // --- Delete orphan Replies (ticketId not in Tickets) ---
    const [orphanReplies] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM `Replies` WHERE `ticketId` NOT IN (SELECT id FROM `Tickets`)'
    );
    console.log(`Orphan Replies to delete: ${orphanReplies[0].cnt}`);
    if (orphanReplies[0].cnt > 0) {
      await conn.execute('DELETE FROM `Replies` WHERE `ticketId` NOT IN (SELECT id FROM `Tickets`)');
      console.log('Orphan Replies deleted ✅');
    }

    // --- Delete orphan Attachments ---
    const [orphanAtt] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM `Attachments` WHERE `ticketId` IS NOT NULL AND `ticketId` NOT IN (SELECT id FROM `Tickets`)'
    );
    console.log(`Orphan Attachments to delete: ${orphanAtt[0].cnt}`);
    if (orphanAtt[0].cnt > 0) {
      await conn.execute('DELETE FROM `Attachments` WHERE `ticketId` IS NOT NULL AND `ticketId` NOT IN (SELECT id FROM `Tickets`)');
      console.log('Orphan Attachments deleted ✅');
    }

    // --- Delete orphan Notifications ---
    const [orphanNotif] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM `Notifications` WHERE `userId` NOT IN (SELECT id FROM `Users`)'
    );
    console.log(`Orphan Notifications to delete: ${orphanNotif[0].cnt}`);
    if (orphanNotif[0].cnt > 0) {
      await conn.execute('DELETE FROM `Notifications` WHERE `userId` NOT IN (SELECT id FROM `Users`)');
      console.log('Orphan Notifications deleted ✅');
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Foreign key checks re-enabled');
    console.log('\n✅ Database fully fixed! Now run: npm run dev\n');

  } catch (err) {
    console.error('Error:', err.message);
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1;');
  } finally {
    await conn.end();
  }
}

fixDatabase();
