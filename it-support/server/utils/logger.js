import fs from 'fs';
import path from 'path';

// Folder named "log" (singular) per user request — fall back to 'logs' for back-compat.
const LOGS_DIR = process.env.LOGS_DIR || 'logs';
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, SECURITY: 50 };

const formatLine = (level, channel, payload) => {
  const ts = new Date().toISOString();
  const data = typeof payload === 'string' ? { message: payload } : (payload || {});
  return JSON.stringify({ ts, level, channel, ...data }) + '\n';
};

const writeToFile = (file, line) => {
  fs.appendFile(path.join(LOGS_DIR, file), line, (err) => {
    if (err) console.error('[logger] write failed:', err);
  });
};

const safeMirrorToConsole = (level, channel, payload) => {
  if (process.env.NODE_ENV === 'production' && LEVELS[level] < LEVELS.WARN) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const tag = `[${channel}/${level}]`;
  if (LEVELS[level] >= LEVELS.ERROR) console.error(tag, data);
  else if (LEVELS[level] >= LEVELS.WARN) console.warn(tag, data);
  else console.log(tag, data);
};

export const logAccess = (payload) => {
  writeToFile('access.log', formatLine('INFO', 'access', payload));
};

export const logSecurity = (payload) => {
  writeToFile('security.log', formatLine('SECURITY', 'security', payload));
  safeMirrorToConsole('SECURITY', 'security', payload);
};

export const logError = (payload) => {
  writeToFile('error.log', formatLine('ERROR', 'app', payload));
  safeMirrorToConsole('ERROR', 'app', payload);
};

export const logInfo = (payload) => {
  writeToFile('app.log', formatLine('INFO', 'app', payload));
  safeMirrorToConsole('INFO', 'app', payload);
};

export const logWarn = (payload) => {
  writeToFile('app.log', formatLine('WARN', 'app', payload));
  safeMirrorToConsole('WARN', 'app', payload);
};

/**
 * logActivity — comprehensive per-action audit trail.
 * Writes BOTH to:
 *   - logs/activity.log (master)
 *   - logs/activity-YYYY-MM-DD.log (daily rotated for easy review)
 *
 * Captures EVERY meaningful action in the system: create/update/delete
 * of assets / users / tickets / replies / categories / invoices.
 */
export const logActivity = (payload) => {
  const line = formatLine('INFO', 'activity', payload);
  writeToFile('activity.log', line);
  const today = new Date().toISOString().slice(0, 10);
  writeToFile(`activity-${today}.log`, line);
};

export default { logAccess, logSecurity, logError, logInfo, logWarn, logActivity };
