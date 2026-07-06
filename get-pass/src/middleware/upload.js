import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.paths.uploads),
  filename: (req, file, cb) => {
    const ext = ALLOWED[file.mimetype] || path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(Object.assign(new Error('نوع الملف غير مسموح. المسموح: JPG, PNG, PDF.'), {
        status: 400, expose: true,
      }));
    }
    cb(null, true);
  },
});
