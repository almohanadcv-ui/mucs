/**
 * MAB UNITED — Support System API
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 * Owner & Developer: IT.MAB
 *
 * Build version: 2026.05.31-trash-v2
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

dotenv.config();

import sequelize from './config/database.js';
import './models/index.js';

import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import userRoutes from './routes/userRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import securityRoutes from './routes/securityRoutes.js';

import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { requestLogger } from './middleware/requestLogger.js';
import { initializeSockets } from './sockets/index.js';
import { recordRateLimitHit } from './utils/securityEvents.js';
import { logInfo } from './utils/logger.js';
import { runStartupMigrations } from './utils/runStartupMigrations.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET غير معرّف أو ضعيف. يرجى ضبطه في ملف .env');
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = FRONTEND_URL.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: corsOptions,
});
initializeSockets(io);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Tell browsers not to guess the Content-Type
  noSniff: true,
  // Block this site from being embedded in an iframe (clickjacking defense)
  frameguard: { action: 'deny' },
  // Strict transport: force HTTPS for the next 6 months
  hsts: { maxAge: 15552000, includeSubDomains: true },
  // Hide the X-Powered-By: Express header (don't advertise the stack)
  hidePoweredBy: true,
  // Referrer policy: don't leak the URL when navigating to external sites
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Disable client-side caching on sensitive API endpoints so tokens/data
// never linger in browser cache (matters on shared/public machines).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(cors(corsOptions));

const IS_PROD = process.env.NODE_ENV === 'production';

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 300 : 5000, // generous in dev to not block testing
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  handler: (req, res) => {
    recordRateLimitHit(req);
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 20/15min on login in prod (prevents brute force) but 1000 in dev
  // Login attempts that SUCCEED should not count toward the limit.
  max: IS_PROD ? 20 : 1000,
  skipSuccessfulRequests: true, // ← only failed logins count
  standardHeaders: true,
  legacyHeaders: false,
  message: 'محاولات كثيرة، يرجى المحاولة بعد 15 دقيقة.',
  handler: (req, res) => {
    recordRateLimitHit(req);
    res.status(429).json({ message: 'محاولات كثيرة، يرجى المحاولة بعد 15 دقيقة.' });
  },
});

app.set('trust proxy', 1); // Behind Nginx/Hostinger reverse proxy
app.use(compression()); // Gzip/Brotli responses
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(hpp());

app.use(requestLogger);

app.use('/uploads', express.static('uploads'));
app.use('/api/uploads', express.static('uploads'));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Diagnostic: list all registered routes (no auth, dev tool)
app.get('/api/__routes', (req, res) => {
  const routes = [];
  const walk = (stack, prefix = '') => {
    stack.forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
        routes.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const match = layer.regexp?.source?.match(/^\^\\?(\/[^\\]*)/);
        const p = match ? match[1] : '';
        walk(layer.handle.stack, prefix + p);
      }
    });
  };
  walk(app._router.stack);
  res.json({ count: routes.length, routes });
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/security', securityRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1) Apply pending column/index migrations BEFORE sync.
    //    This ensures columns like deletedAt exist before Sequelize
    //    tries to use them via the paranoid:true option.
    await runStartupMigrations();

    // 2) Create any missing tables.
    if (process.env.DB_SYNC_ALTER === '1') {
      console.log('⏳ Running sequelize.sync({ alter: true })...');
      await sequelize.sync({ alter: true });
      console.log('✅ Schema altered.');
    } else {
      await sequelize.sync();
      console.log('✅ Schema verified (creating missing tables only).');
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logInfo({ event: 'server_start', port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
};

startServer();
