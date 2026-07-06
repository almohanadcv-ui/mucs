// Lightweight IP geolocation using ip-api.com (free, no API key required).
// We never block requests on this — it's fire-and-forget with a small in-memory cache.

const cache = new Map(); // ip → { data, expiresAt }
const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE = 500;

const isPrivateIp = (ip) => {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && parseInt(m[1], 10) >= 16 && parseInt(m[1], 10) <= 31) return true;
  return false;
};

export const lookupIp = async (ip) => {
  if (!ip || isPrivateIp(ip)) {
    return { ip, country: 'local', region: '-', city: '-', isp: '-' };
  }

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (process.env.DISABLE_IP_LOOKUP === '1') {
    return { ip, country: '-', region: '-', city: '-', isp: '-' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,query`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    if (json.status !== 'success') throw new Error('lookup failed');

    const data = {
      ip,
      country: json.country || '-',
      region: json.regionName || '-',
      city: json.city || '-',
      isp: json.isp || '-',
    };

    if (cache.size >= MAX_CACHE) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(ip, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  } catch {
    return { ip, country: '-', region: '-', city: '-', isp: '-' };
  }
};

export const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};
