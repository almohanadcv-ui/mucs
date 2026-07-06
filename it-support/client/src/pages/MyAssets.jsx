import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const formatPrice = (p) => {
  if (!p) return '—';
  const n = Number(p);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString()} ر.س`;
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-EG');
  } catch {
    return d;
  }
};

const Field = ({ label, value, mono = false }) => (
  <div>
    <p className="text-[11px] text-gray-500 mb-1">{label}</p>
    <p className={`text-sm ${mono ? 'font-mono' : 'font-semibold'} ${value ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
      {value || '—'}
    </p>
  </div>
);

const MyAssets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/assets/mine');
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error('فشل تحميل العهد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">عهدتي</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            العهد التقنية المسجّلة باسمك — اضغط لعرض التفاصيل
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">الإجمالي</p>
          <p className="text-2xl font-bold text-primary-600">{assets.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">جاري التحميل...</div>
      ) : assets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500">لا توجد عهد مسجّلة باسمك حالياً</p>
          <p className="text-xs text-gray-400 mt-2">راجع قسم IT لتسجيل عهدك في النظام</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelected(a)}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">التصنيف</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {a.Category?.nameAr || a.Category?.name || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">الموقع</p>
                  <p className="font-semibold text-gray-800 dark:text-white">{a.location || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">السعر</p>
                  <p className="font-semibold text-primary-600">{formatPrice(a.purchasePrice)}</p>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-center">
                  <span className="text-xs text-primary-600 dark:text-primary-400 font-semibold">
                    👆 اضغط لعرض كل التفاصيل
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-primary-600 text-white">
                <h2 className="font-bold text-lg">تفاصيل العهدة</h2>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-white/10 rounded">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="رقم العهدة" value={selected.assetTag} mono />
                  <Field label="رقم اودو" value={selected.odooNumber} mono />
                  <Field label="التصنيف" value={selected.Category?.nameAr || selected.Category?.name} />
                  <Field label="الموقع" value={selected.location} />
                  <Field label="الرقم التسلسلي" value={selected.serialNumber} mono />
                  <Field label="اللون" value={selected.deviceColor} />
                  <Field label="السعر" value={selected.purchasePrice ? `${Number(selected.purchasePrice).toLocaleString()} ر.س` : null} />
                  <Field label="تاريخ التسليم" value={formatDate(selected.assignmentDate)} />
                </div>

                {selected.specifications && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm border border-blue-200 dark:border-blue-900">
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold mb-1">المواصفات</p>
                    <p className="whitespace-pre-wrap">{selected.specifications}</p>
                  </div>
                )}

                {selected.invoiceFile && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-2 font-semibold">الفاتورة</p>
                    <div className="flex gap-2">
                      <a
                        href={selected.invoiceFile}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-semibold py-2 rounded-lg text-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        عرض الفاتورة
                      </a>
                      <a
                        href={selected.invoiceFile}
                        download
                        className="flex-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-semibold py-2 rounded-lg text-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                      >
                        تحميل
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyAssets;
