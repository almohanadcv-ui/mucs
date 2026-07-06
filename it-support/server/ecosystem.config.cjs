/**
 * MAB UNITED — PM2 Ecosystem
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 *
 * Usage on VPS:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup           # makes PM2 boot on reboot
 *   pm2 logs mab-api
 *   pm2 monit
 *
 * To enable nightly backups (cron via PM2):
 *   pm2 start ecosystem.config.cjs --only mab-backup-cron
 */
module.exports = {
  apps: [
    {
      name: 'mab-api',
      script: 'server.js',
      cwd: __dirname,
      instances: process.env.PM2_INSTANCES || 'max', // cluster mode across all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      // Nightly DB backup at 03:00 — runs once and exits, PM2 cron triggers it.
      name: 'mab-backup-cron',
      script: 'scripts/backup.js',
      cwd: __dirname,
      cron_restart: '0 3 * * *', // every day at 03:00
      autorestart: false,
      env: { NODE_ENV: 'production' },
      out_file: './logs/backup-out.log',
      error_file: './logs/backup-error.log',
    },
  ],
};
