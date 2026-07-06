/**
 * MAB UNITED — Trash (Deleted Tickets)
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Trash2, RotateCcw, AlertTriangle, RefreshCw, Search,
  User, Calendar, Tag, Clock, Shield, Eye, X
} from 'lucide-react';

const Trash = () => {
  const { user } = useAuth();
  const socket = useSocket();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchDeleted = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/tickets/deleted');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setTickets([]);
      if (error?.response?.status !== 401) {
        toast.error('فشل تحميل سلة المحذوفات');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeleted();
  }, []);

  // Listen for new deletions / restorations from other admins
  useEffect(() => {
    if (!socket) return;
    const onDeleted = () => fetchDeleted();
    const onRestored = ({ id }) => {
      setTickets(prev => prev.filter(t => t.id !== id));
    };
    const onForceDeleted = ({ id }) => {
      setTickets(prev => prev.filter(t => t.id !== id));
    };
    socket.on('ticket_deleted', onDeleted);
    socket.on('ticket_restored', onRestored);
    socket.on('ticket_force_deleted', onForceDeleted);
    return () => {
      socket.off('ticket_deleted', onDeleted);
      socket.off('ticket_restored', onRestored);
      socket.off('ticket_force_deleted', onForceDeleted);
    };
  }, [socket]);

  const handleRestore = async (ticket) => {
    if (!window.confirm(`استعادة التذكرة "${ticket.title}"؟`)) return;
    try {
      await axios.post(`/api/tickets/${ticket.id}/restore`);
      toast.success('تم استعادة التذكرة بنجاح ✅');
      setTickets(prev => prev.filter(t => t.id !== ticket.id));
      setSelectedTicket(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'فشل الاستعادة');
    }
  };

  const handleForceDelete = async (ticket) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.role)) {
      return toast.error('الحذف النهائي للأدمن فقط');
    }
    if (!window.confirm(`⚠️ تحذير!\n\nستحذف التذكرة "${ticket.title}" نهائياً ولا يمكن استعادتها.\n\nهل أنت متأكد؟`)) {
      return;
    }
    try {
      await axios.post(`/api/tickets/${ticket.id}/force-delete`);
      toast.success('تم الحذف النهائي');
      setTickets(prev => prev.filter(t => t.id !== ticket.id));
      setSelectedTicket(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'فشل الحذف النهائي');
    }
  };

  const filtered = tickets.filter(t =>
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.deletedByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryMap = {
    'HARDWARE': 'أجهزة',
    'PRINTERS': 'طابعات',
    'INTERNET': 'إنترنت',
    'NETWORK': 'شبكة',
    'SOFTWARE': 'برامج',
    'EMAIL': 'إيميل',
    'BILLING': 'فواتير',
    'OTHER': 'أخرى',
  };

  const roleMap = {
    'IT_SUPPORT': 'دعم فني',
    'ADMIN': 'مدير',
    'SUPER_ADMIN': '.',
    'EMPLOYEE': 'موظف',
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700/60 pb-5">
        <div>
          <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            <Trash2 size={24} className="text-red-500" />
            سلة المحذوفات
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            التذاكر التي تم حذفها — يمكن استعادتها أو حذفها نهائياً
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold">
            {tickets.length} تذكرة محذوفة
          </span>
          <button
            onClick={fetchDeleted}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title="تحديث"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="بحث بالعنوان، رقم التذكرة، أو اسم الحاذف..."
            className="input-field pr-9 w-full"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <strong>ملاحظات هامة:</strong>
          <ul className="mt-1 space-y-1 list-disc pr-4">
            <li>التذاكر المحذوفة تبقى في السلة لكن لا تظهر في القوائم الرئيسية</li>
            <li>يمكن للأدمن أو الدعم الفني <strong>استعادتها</strong> ♻️</li>
            <li>الحذف النهائي ⛔ متاح فقط للأدمن، ولا يمكن التراجع عنه</li>
          </ul>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card h-32 animate-pulse bg-gray-100 dark:bg-gray-800/40"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Trash2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">سلة المحذوفات فارغة</p>
          <p className="text-xs mt-2">لا توجد تذاكر محذوفة حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ticket, idx) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="card border-r-4 border-red-500 hover:shadow-lg transition-all relative"
            >
              {/* Tag */}
              <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 flex items-center gap-1">
                <Trash2 size={10} /> محذوفة
              </span>

              <div className="pr-2">
                <h3 className="font-bold text-sm dark:text-white truncate">{ticket.title}</h3>
                <p className="text-[10px] text-gray-400 font-mono">#{ticket.id?.substring(0, 8)}</p>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Tag size={12} className="text-gray-400" />
                  <span>{categoryMap[ticket.category] || ticket.category}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <User size={12} className="text-gray-400" />
                  <span>صاحب الطلب: {ticket.Creator?.name || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded">
                  <Shield size={12} />
                  <span>حُذفت بواسطة: {ticket.deletedByName} ({roleMap[ticket.deletedByRole] || ticket.deletedByRole})</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Clock size={12} />
                  <span>{formatDate(ticket.deletedAt)}</span>
                </div>
                {ticket.deletionReason && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-2 rounded border border-gray-100 dark:border-gray-700/50">
                    📝 السبب: {ticket.deletionReason}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold transition-colors"
                >
                  <Eye size={12} />
                  عرض
                </button>
                <button
                  onClick={() => handleRestore(ticket)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs font-bold transition-colors"
                  title="استعادة التذكرة"
                >
                  <RotateCcw size={12} />
                  استعادة
                </button>
                {['ADMIN', 'SUPER_ADMIN'].includes(user?.role) && (
                  <button
                    onClick={() => handleForceDelete(ticket)}
                    className="flex items-center justify-center p-1.5 px-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="حذف نهائي - لا يمكن التراجع"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal — centered overlay */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          onClick={() => setSelectedTicket(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-500 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Trash2 size={18} />
                <span className="font-bold">تذكرة محذوفة — #{selectedTicket.id?.substring(0, 8)}</span>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <p className="text-xs text-gray-400 font-bold mb-1">العنوان</p>
                <h3 className="text-lg font-bold dark:text-white">{selectedTicket.title}</h3>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold mb-1">الوصف</p>
                <p className="text-sm dark:text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-400 font-bold">التصنيف</p>
                  <p className="dark:text-gray-300 mt-1">{categoryMap[selectedTicket.category]}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-bold">الحالة قبل الحذف</p>
                  <p className="dark:text-gray-300 mt-1">{selectedTicket.status}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-bold">صاحب الطلب</p>
                  <p className="dark:text-gray-300 mt-1">{selectedTicket.Creator?.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-bold">تاريخ الإنشاء</p>
                  <p className="dark:text-gray-300 mt-1">{formatDate(selectedTicket.createdAt)}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <p className="text-xs text-red-500 font-bold mb-2">معلومات الحذف</p>
                <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">حُذفت بواسطة:</span>
                    <span className="font-bold dark:text-gray-300">
                      {selectedTicket.deletedByName} ({roleMap[selectedTicket.deletedByRole] || selectedTicket.deletedByRole})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">تاريخ الحذف:</span>
                    <span className="font-bold dark:text-gray-300">{formatDate(selectedTicket.deletedAt)}</span>
                  </div>
                  {selectedTicket.deletionReason && (
                    <div>
                      <span className="text-gray-500">السبب:</span>
                      <p className="font-bold dark:text-gray-300 mt-1">{selectedTicket.deletionReason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleRestore(selectedTicket)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
                >
                  <RotateCcw size={16} />
                  استعادة التذكرة
                </button>
                {['ADMIN', 'SUPER_ADMIN'].includes(user?.role) && (
                  <button
                    onClick={() => handleForceDelete(selectedTicket)}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors"
                  >
                    <Trash2 size={16} />
                    حذف نهائي
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Trash;
