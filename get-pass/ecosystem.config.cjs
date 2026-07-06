// إعداد PM2 لتشغيل النظام دائماً وإعادة تشغيله تلقائياً
module.exports = {
  apps: [
    {
      name: 'pams',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
      // بقية المتغيّرات السرية تُقرأ من ملف .env (عبر dotenv)
    },
  ],
};
