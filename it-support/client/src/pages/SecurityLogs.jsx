import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  Shield, Search, RefreshCw, CheckCircle, XCircle, AlertCircle,
  Clock, MapPin, Monitor, User as UserIcon, Filter, Download,
} from 'lucide-react';

const EVENT_LABEL = {
  login_success: 'دخول ناجح',
  login_failed: 'دخول فاشل',
  password_changed: 'تغيير كلمة المرور',
  forbidden: 'محاولة وصول مرفوض',
  rate_limit_hit: 'محاولات كثيرة',
  suspicious: 'نشاط مشبوه',
};

const EVENT_STYLE = {
  login_success: { icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400' },
  login_failed: { icon: XCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  password_changed: { icon: Shield, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  forbidden: { icon: AlertCircle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400' },
  rate_limit_hit: { icon: AlertCircle, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400' },
  suspicious: { icon: AlertCircle, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
};

const FAILURE_REASON = {
  bad_password: 'كلمة مرور خاطئة',
  bad_temp_code: 'رمز مؤقت غير صحيح',
  user_not_found: 'الحساب غير موجود',
  inactive: 'الحساب غير مفعّل',
  wrong_portal: 'دخول من بوابة خاطئة',
  already_logged_in: 'مسجّل دخول من جهاز آخر',
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

const parseUA = (ua) => {
  if (!ua) return '—';
  let browser = '?';
  let os = '?';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}`;
};

const SecurityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [limit, setLimit] = useState(50);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [showFiles, setShowFiles] = useState(false);
  const [logFiles, setLogFiles] = useState([]);

  const loadFiles = async () => {
    try {
      const res = await axios.get('/api/security/log-files');
      setLogFiles(Array.isArray(res.data?.files) ? res.data.files : []);
    } catch (err) {
      toast.error('فشل تحميل قائمة الملفات');
    }
  };

  const downloadFile = (name) => {
    // Use a direct download (auth header will be included by axios defaults)
    axios
      .get(`/api/security/log-files/${name}`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('فشل تنزيل الملف'));
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit };
      if (filterEvent) params.event = filterEvent;
      if (search) params.search = search;
      const res = await axios.get('/api/security/logs', { params });
      setLogs(Array.isArray(res.data?.logs) ? res.data.logs : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحميل السجل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, filterEvent]);

  // Live search — debounce 300ms so we don't spam the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Shield className="text-primary-600" /> سجل النشاط الأمني
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            مراقبة كل عمليات الدخول ومحاولات الوصول للنظام
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowFiles(true); loadFiles(); }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-50"
          >
            <Download size={16} />
            ملفات اللوقات
          </button>
          <button
            onClick={load}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} />
            تحديث
          </button>
        </div>
      </div>

      {/* Log files download modal */}
      {showFiles && (
        <div onClick={() => setShowFiles(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-primary-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2"><Download size={18} /> ملفات السجل</h3>
              <button onClick={() => setShowFiles(false)} className="text-white hover:bg-white/10 p-1 rounded">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {logFiles.length === 0 ? (
                <div className="text-center text-gray-400 py-8">لا توجد ملفات حالياً.</div>
              ) : (
                <div className="space-y-2">
                  {logFiles.map((f) => (
                    <div key={f.name} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold text-gray-800 dark:text-white truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {(f.size / 1024).toFixed(1)} KB · {new Date(f.mtime).toLocaleString('ar-EG')}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadFile(f.name)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <Download size={12} /> تحميل
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px]">
              ⚠️ ملفات السجل على Railway مؤقتة وتُمسح عند كل نشر جديد. للاحتفاظ بسجل دائم استخدم صفحة "سجل النشاط" (مخزّن في DB).
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالبريد، الاسم، الـ IP، أو المدينة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          <option value="">كل الأحداث</option>
          <option value="login_success">دخول ناجح</option>
          <option value="login_failed">دخول فاشل</option>
          <option value="password_changed">تغيير كلمة مرور</option>
          <option value="forbidden">وصول مرفوض</option>
          <option value="rate_limit_hit">محاولات كثيرة</option>
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          <option value="10">آخر 10</option>
          <option value="25">آخر 25</option>
          <option value="50">آخر 50</option>
          <option value="100">آخر 100</option>
          <option value="200">آخر 200</option>
        </select>
        <button
          onClick={load}
          className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
        >
          <Filter size={14} />
          تطبيق
        </button>

        {/* View toggle: Table vs Cards */}
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            📊 جدول
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            🗂️ بطاقات
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">جاري التحميل...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Shield className="mx-auto mb-3 opacity-30" size={48} />
            لا توجد سجلات بعد
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">الحدث</th>
                  <th className="text-right px-3 py-2.5 font-bold">المستخدم</th>
                  <th className="text-right px-3 py-2.5 font-bold">البريد</th>
                  <th className="text-right px-3 py-2.5 font-bold">الدور</th>
                  <th className="text-right px-3 py-2.5 font-bold">IP</th>
                  <th className="text-right px-3 py-2.5 font-bold">المدينة</th>
                  <th className="text-right px-3 py-2.5 font-bold">الدولة</th>
                  <th className="text-right px-3 py-2.5 font-bold">المتصفح</th>
                  <th className="text-right px-3 py-2.5 font-bold">السبب</th>
                  <th className="text-right px-3 py-2.5 font-bold">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const style = EVENT_STYLE[log.eventType] || EVENT_STYLE.suspicious;
                  const reasonLabel = FAILURE_REASON[log.reason] || log.reason || '—';
                  return (
                    <tr key={log.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-xs">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${style.color}`}>
                          {EVENT_LABEL[log.eventType] || log.eventType}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold">{log.userName || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{log.email || '—'}</td>
                      <td className="px-3 py-2">
                        {log.role && (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">{log.role}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{log.ip || '—'}</td>
                      <td className="px-3 py-2">{log.city || '—'}</td>
                      <td className="px-3 py-2">{log.country || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{parseUA(log.userAgent)}</td>
                      <td className="px-3 py-2">
                        {reasonLabel !== '—' && (
                          <span className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold">
                            {reasonLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-[10px]">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {logs.map((log) => {
              const style = EVENT_STYLE[log.eventType] || EVENT_STYLE.suspicious;
              const Icon = style.icon;
              const reasonLabel = FAILURE_REASON[log.reason] || log.reason;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${style.color} shrink-0`}>
                      <Icon size={18} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${style.color}`}>
                          {EVENT_LABEL[log.eventType] || log.eventType}
                        </span>
                        {log.role && (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-mono text-gray-600 dark:text-gray-300">
                            {log.role}
                          </span>
                        )}
                        {reasonLabel && (
                          <span className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
                            {reasonLabel}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-gray-800 dark:text-white">
                        {log.userName || log.email || '— مستخدم غير معروف —'}
                      </div>
                      {log.email && log.userName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {log.email}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDateTime(log.createdAt)}
                        </span>
                        {(log.city || log.country) && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {[log.city, log.country].filter(Boolean).join('، ')}
                          </span>
                        )}
                        {log.ip && (
                          <span className="font-mono text-[11px]">
                            🌐 {log.ip}
                          </span>
                        )}
                        {log.isp && (
                          <span className="text-[11px]">
                            ({log.isp})
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Monitor size={12} />
                          {parseUA(log.userAgent)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        يُسجَّل كل حدث تلقائياً ويُحفظ بشكل دائم في قاعدة البيانات
      </p>
    </div>
  );
};

export default SecurityLogs;
