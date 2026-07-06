import fs from 'node:fs';
import { config } from '../config.js';

// حذف ملفات قاعدة البيانات لإعادة البناء من الصفر
for (const suffix of ['', '-wal', '-shm']) {
  const f = config.paths.db + suffix;
  if (fs.existsSync(f)) {
    fs.rmSync(f);
    console.log('🗑️  حُذف:', f);
  }
}
console.log('✅ أُعيد ضبط قاعدة البيانات. شغّل: npm run seed');
process.exit(0);
