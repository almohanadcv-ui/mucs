import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Search, Package, AlertTriangle, DollarSign, Users as UsersIcon,
  X, Edit2, UserPlus, RotateCcw, Trash2, ChevronRight, ChevronLeft,
  Laptop, Printer, Monitor, Smartphone, Wifi, Server,
  Calendar, Hash, MapPin, FileText, Building, Download, Tag, Eye, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { printAssetLabel, printMultipleLabels } from '../utils/assetLabel';
import { exportAssetsToExcel, exportAssetsForPTouch } from '../utils/assetExport';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'الكل' },
  { value: 'AVAILABLE', label: 'متاح' },
  { value: 'ASSIGNED', label: 'مع الموظف' },
  { value: 'IN_REPAIR', label: 'في الصيانة' },
  { value: 'RETIRED', label: 'متقاعد' },
  { value: 'LOST', label: 'مفقود' },
];

// Simplified options shown in the create/edit form
const FORM_STATUS_OPTIONS = [
  { value: 'ASSIGNED', label: 'مع الموظف' },
  { value: 'IN_REPAIR', label: 'في الصيانة' },
  { value: 'LOST', label: 'مفقود' },
];

// Preset locations with short codes used on labels
const LOCATION_PRESETS = [
  { name: 'القدية', code: 'Qid' },
  { name: 'الدرعية', code: 'Dir' },
  { name: 'المقر الرئيسي', code: 'HO' },
];

// Look up a short code for any location string (preset or free-text)
export const codeForLocation = (loc) => {
  if (!loc) return '';
  const preset = LOCATION_PRESETS.find(p => p.name === loc);
  return preset ? preset.code : '';
};

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'جديد' },
  { value: 'GOOD', label: 'ممتاز' },
  { value: 'FAIR', label: 'جيد' },
  { value: 'POOR', label: 'يحتاج صيانة' },
  { value: 'BROKEN', label: 'معطّل' },
];

const STATUS_BADGE = {
  AVAILABLE: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-green-100 text-green-700',
  IN_REPAIR: 'bg-amber-100 text-amber-700',
  RETIRED: 'bg-gray-200 text-gray-600',
  LOST: 'bg-red-100 text-red-700',
};

const STATUS_LABEL = {
  AVAILABLE: 'متاح',
  ASSIGNED: 'مع الموظف',
  IN_REPAIR: 'في الصيانة',
  RETIRED: 'متقاعد',
  LOST: 'مفقود',
};

const iconForCategory = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('laptop') || n.includes('لابتوب')) return Laptop;
  if (n.includes('print') || n.includes('طابع')) return Printer;
  if (n.includes('monitor') || n.includes('شاش')) return Monitor;
  if (n.includes('phone') || n.includes('موبايل')) return Smartphone;
  if (n.includes('router') || n.includes('راوتر')) return Wifi;
  if (n.includes('server') || n.includes('سيرفر')) return Server;
  return Package;
};

const emptyAsset = {
  assetTag: '',
  odooNumber: '',
  categoryId: '',
  serialNumber: '',
  specifications: '',
  deviceColor: '',
  invoiceFile: '',
  purchaseDate: '',
  purchasePrice: '',
  status: 'ASSIGNED',
  condition: 'GOOD',
  location: '',
  notes: '',
  currentUserId: '',
  assignmentDate: '',
};

const Assets = () => {
  const { user } = useAuth();
  const isManager = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [showCatModal, setShowCatModal] = useState(false);
  const [showByUser, setShowByUser] = useState(false);
  const [byUserData, setByUserData] = useState(null);
  const [selectedByUserId, setSelectedByUserId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadAll = async () => {
    setLoading(true);
    try {
      const [aRes, cRes, uRes, sRes] = await Promise.all([
        axios.get('/api/assets', { params: { limit: 1000 } }),
        axios.get('/api/assets/categories'),
        axios.get('/api/users').catch(() => ({ data: [] })),
        axios.get('/api/assets/stats').catch(() => ({ data: null })),
      ]);
      setAssets(Array.isArray(aRes.data?.assets) ? aRes.data.assets : []);
      setCategories(Array.isArray(cRes.data) ? cRes.data : []);
      const userList = Array.isArray(uRes.data) ? uRes.data : (uRes.data?.users || []);
      setUsers(userList);
      setStats(sRes.data);
    } catch (err) {
      console.error(err);
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (categoryFilter && a.categoryId !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hit =
          (a.assetTag || '').toLowerCase().includes(s) ||
          (a.brand || '').toLowerCase().includes(s) ||
          (a.model || '').toLowerCase().includes(s) ||
          (a.serialNumber || '').toLowerCase().includes(s) ||
          (a.CurrentUser?.name || '').toLowerCase().includes(s);
        if (!hit) return false;
      }
      return true;
    });
  }, [assets, search, statusFilter, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openDetail = async (asset) => {
    setSelected(asset);
    setDetail(null);
    try {
      const res = await axios.get(`/api/assets/${asset.id}`);
      setDetail(res.data);
    } catch (err) {
      toast.error('فشل تحميل التفاصيل');
    }
  };

  const saveAsset = async (data) => {
    try {
      if (editing) {
        await axios.put(`/api/assets/${editing.id}`, data);
        toast.success('تم التحديث');
      } else {
        await axios.post('/api/assets', data);
        toast.success('تم الإضافة');
      }
      setEditing(null);
      setCreating(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحفظ');
    }
  };

  const submitAssign = async () => {
    if (!assignUserId) return toast.error('اختر موظفاً');
    try {
      await axios.post(`/api/assets/${selected.id}/assign`, {
        userId: assignUserId,
        conditionOnAssignment: selected.condition || 'GOOD',
      });
      toast.success('تم التسليم');
      setAssigning(false);
      setAssignUserId('');
      await openDetail(selected);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل التسليم');
    }
  };

  const returnFromUser = async () => {
    if (!window.confirm('استرجاع هذه العهدة من الموظف الحالي؟')) return;
    try {
      await axios.post(`/api/assets/${selected.id}/return`, {});
      toast.success('تم الاسترجاع');
      await openDetail(selected);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    }
  };

  const loadByUser = async (userId) => {
    if (!userId) { setByUserData(null); return; }
    try {
      const res = await axios.get(`/api/assets/by-user/${userId}`);
      setByUserData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل التحميل');
    }
  };

  // Selection helpers: when items are selected we operate on those; otherwise on filtered
  const getSelectedAssets = () => {
    if (selectedIds.size === 0) return null;
    return filtered.filter(a => selectedIds.has(a.id));
  };
  const exporterInfo = user ? { name: user.name, role: user.role } : null;

  const handleExportSelected = () => {
    const sel = getSelectedAssets();
    const target = sel && sel.length ? sel : filtered;
    if (target.length === 0) return toast.error('لا توجد عهد للتصدير');
    const label = sel ? 'العهد المحددة' : 'العهد القنية (مفلتر)';
    exportAssetsToExcel(target, 'mab-assets-selected.xls', label, exporterInfo);
    toast.success(`تم تصدير ${target.length} أصل`);
  };

  const handleExportFiltered = () => {
    if (filtered.length === 0) return toast.error('لا توجد عهد للتصدير');
    exportAssetsToExcel(filtered, 'mab-assets-filtered.xls', 'العهد  (مفلتر)', exporterInfo);
    toast.success(`تم تصدير ${filtered.length} أصل`);
  };

  const handleExportAll = () => {
    if (assets.length === 0) return toast.error('لا توجد عهد للتصدير');
    exportAssetsToExcel(assets, 'mab-assets-all.xls', 'كل العهد ', exporterInfo);
    toast.success(`تم تصدير كل العهد (${assets.length})`);
  };

  const handleExportPTouch = () => {
    const sel = getSelectedAssets();
    const target = sel && sel.length ? sel : filtered;
    if (target.length === 0) return toast.error('لا توجد عهد');
    exportAssetsForPTouch(target, 'mab-ptouch.csv');
    toast.success('CSV جاهز للاستيراد في Brother P-Touch');
  };

  const handlePrintAll = () => {
    const sel = getSelectedAssets();
    const target = sel && sel.length ? sel : filtered;
    if (target.length === 0) return toast.error('لا توجد عهد للطباعة');
    if (target.length > 50 && !window.confirm(`سيتم طباعة ${target.length} ملصق. متأكد؟`)) return;
    printMultipleLabels(target);
  };

  // Selection helpers
  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    const pageIds = pageItems.map(a => a.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = pageIds.every(id => next.has(id));
      if (allSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };
  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map(a => a.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const deleteAsset = async () => {
    if (!isManager) return toast.error('غير مصرّح');
    const reason = window.prompt('سبب الحذف (اختياري):') ?? '';
    if (!window.confirm('تأكيد الحذف؟')) return;
    try {
      await axios.post(`/api/assets/${selected.id}/delete`, { reason });
      toast.success('تم الحذف');
      setSelected(null);
      setDetail(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحذف');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة العهد </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تتبّع كل عهد الشركة وتخصيصها وصيانتها
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowByUser(true)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-50"
          >
            <Eye size={16} />
            عرض حسب الموظف
          </button>
          <ExportDropdown
            onExportSelected={handleExportSelected}
            onExportFiltered={handleExportFiltered}
            onExportAll={handleExportAll}
            onExportPTouch={handleExportPTouch}
            selectedCount={selectedIds.size}
            filteredCount={filtered.length}
            totalCount={assets.length}
          />
          <button
            onClick={handlePrintAll}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-50"
            title="طباعة ملصقات لكل العهد المعروضة"
          >
            <Tag size={16} />
            طباعة ملصقات
          </button>
          <button
            onClick={() => setShowCatModal(true)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-50"
          >
            <Building size={16} />
            التصنيفات
          </button>
          <button
            onClick={() => setCreating(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-primary-700"
          >
            <Plus size={16} />
            إضافة عهده
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">إجمالي العهد</p>
              <Package size={16} className="text-primary-500" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">القيمة الإجمالية</p>
              <DollarSign size={16} className="text-green-500" />
            </div>
            <p className="text-2xl font-bold">{Number(stats.totalValue || 0).toLocaleString()} ر.س</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">المخصّصة لموظفين</p>
              <UsersIcon size={16} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold">
              {(stats.byStatus || []).find(s => s.status === 'ASSIGNED')?.count || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث برقم العهده الماركة، أو الموظف..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          <option value="">كل التصنيفات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
        </select>
      </div>

      {/* Selection bar (visible when items selected) */}
      {selectedIds.size > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-primary-600 text-white text-sm font-bold rounded-full px-3 py-1">
              {selectedIds.size} محدّد
            </span>
            <button
              onClick={selectAllFiltered}
              className="text-xs text-primary-700 dark:text-primary-300 hover:underline"
            >
              اختر كل المعروض ({filtered.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
            >
              إلغاء التحديد
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportSelected}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download size={14} />
              تصدير المحدّد ({selectedIds.size})
            </button>
            <button
              onClick={handlePrintAll}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Tag size={14} />
              طباعة ملصقات ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">جاري التحميل...</div>
        ) : pageItems.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Package className="mx-auto mb-3 opacity-30" size={48} />
            لا توجد عهد مطابقة
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={pageItems.length > 0 && pageItems.every(a => selectedIds.has(a.id))}
                      onChange={togglePage}
                      className="w-4 h-4 cursor-pointer accent-primary-600"
                      title="اختر الكل في هذه الصفحة"
                    />
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">رقم العهده</th>
                  <th className="text-right px-4 py-3 font-semibold">النوع</th>
                  <th className="text-right px-4 py-3 font-semibold">الماركة/الموديل</th>
                  <th className="text-right px-4 py-3 font-semibold">المستخدم الحالي</th>
                  <th className="text-right px-4 py-3 font-semibold">الموقع</th>
                  <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((a) => {
                  const Icon = iconForCategory(a.Category?.name);
                  const isSelected = selectedIds.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={`border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                        isSelected ? 'bg-primary-50/40 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(a.id)}
                          className="w-4 h-4 cursor-pointer accent-primary-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs cursor-pointer" onClick={() => openDetail(a)}>{a.assetTag}</td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(a)}>
                        <div className="flex items-center gap-2">
                          <Icon size={16} className="text-primary-500" />
                          <span>{a.Category?.nameAr || a.Category?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(a)}>{[a.brand, a.model].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(a)}>{a.CurrentUser?.name || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 cursor-pointer" onClick={() => openDetail(a)}>{a.location || '-'}</td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(a)}>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_BADGE[a.status]}`}>
                          {STATUS_LABEL[a.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-500">صفحة {page} من {pageCount}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelected(null); setDetail(null); }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-bold text-lg">تفاصيل العهدة</h2>
                <button onClick={() => { setSelected(null); setDetail(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Field label="رقم العهده" value={selected.assetTag} mono />
                  <Field label="رقم اودو" value={selected.odooNumber} mono />
                  <Field label="الحالة" value={STATUS_LABEL[selected.status]} />
                  <Field label="الرقم التسلسلي" value={selected.serialNumber} mono />
                  <Field label="تاريخ الشراء" value={selected.purchaseDate} />
                  <Field label="السعر" value={selected.purchasePrice ? `${selected.purchasePrice} ر.س` : null} />
                  <Field label="الموقع" value={selected.location} />
                  <Field label="المستخدم الحالي" value={selected.CurrentUser?.name} />
                  <Field label="تاريخ التسليم" value={selected.assignmentDate} />
                  <Field label="التصنيف" value={selected.Category?.nameAr || selected.Category?.name} />
                </div>

                {selected.specifications && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm border border-blue-200 dark:border-blue-900">
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold mb-1">المواصفات</p>
                    <p className="whitespace-pre-wrap">{selected.specifications}</p>
                  </div>
                )}

                {selected.notes && (
                  <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg text-sm">
                    <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
                    <p>{selected.notes}</p>
                  </div>
                )}

                {/* History */}
                {detail?.history?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">سجل التنقّلات</h3>
                    <div className="space-y-2">
                      {detail.history.slice(0, 5).map((h) => (
                        <div key={h.id} className="text-xs bg-gray-50 dark:bg-gray-900/40 p-2 rounded">
                          <div className="flex justify-between">
                            <span><strong>{h.Holder?.name}</strong></span>
                            <span className="text-gray-500">
                              {new Date(h.assignedAt).toLocaleDateString('ar-EG')}
                              {h.returnedAt && ` → ${new Date(h.returnedAt).toLocaleDateString('ar-EG')}`}
                            </span>
                          </div>
                          {h.AssignedByUser?.name && (
                            <div className="text-gray-400 mt-1">سلّمه: {h.AssignedByUser.name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maintenance log */}
                {detail?.maintenance?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">سجل الصيانة</h3>
                    <div className="space-y-2">
                      {detail.maintenance.slice(0, 5).map((m) => (
                        <div key={m.id} className="text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                          <div className="flex justify-between">
                            <strong>{m.issue}</strong>
                            <span className="text-gray-500">
                              {new Date(m.performedAt).toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                          {m.resolution && <p className="text-gray-600 dark:text-gray-300 mt-1">{m.resolution}</p>}
                          {m.cost > 0 && <p className="text-amber-700 mt-1">التكلفة: {m.cost} ر.س</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 justify-end">
                {!selected.currentUserId ? (
                  <button
                    onClick={() => setAssigning(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <UserPlus size={16} />
                    تسليم لموظف
                  </button>
                ) : (
                  <button
                    onClick={returnFromUser}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <RotateCcw size={16} />
                    استرجاع
                  </button>
                )}
                <button
                  onClick={() => printAssetLabel(selected)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Tag size={16} />
                  طباعة ملصق
                </button>
                <button
                  onClick={() => setEditing(selected)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  تعديل
                </button>
                {isManager && (
                  <button
                    onClick={deleteAsset}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    حذف
                  </button>
                )}
              </div>

              {/* Inline assign panel */}
              {assigning && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                  <label className="block text-sm font-semibold mb-2">اختر الموظف</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm mb-3"
                  >
                    <option value="">— اختر —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setAssigning(false); setAssignUserId(''); }}
                      className="px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={submitAssign}
                      className="px-3 py-1.5 text-sm rounded bg-green-600 text-white"
                    >
                      تأكيد التسليم
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {(creating || editing) && (
          <AssetFormModal
            initial={editing || emptyAsset}
            categories={categories}
            users={users}
            isEditing={!!editing}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSave={saveAsset}
          />
        )}
      </AnimatePresence>

      {/* View By Employee Modal */}
      <AnimatePresence>
        {showByUser && (
          <ByUserModal
            users={users}
            selectedUserId={selectedByUserId}
            data={byUserData}
            exporterInfo={exporterInfo}
            onSelectUser={(uid) => { setSelectedByUserId(uid); loadByUser(uid); }}
            onClose={() => { setShowByUser(false); setByUserData(null); setSelectedByUserId(''); }}
            onPrintLabel={printAssetLabel}
          />
        )}
      </AnimatePresence>

      {/* Categories Modal */}
      <AnimatePresence>
        {showCatModal && (
          <CategoriesModal
            categories={categories}
            onClose={() => setShowCatModal(false)}
            onChange={loadAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const Field = ({ label, value, mono }) => (
  <div>
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`${mono ? 'font-mono text-xs' : ''} ${value ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
      {value || '—'}
    </p>
  </div>
);

const AssetFormModal = ({ initial, categories, users = [], isEditing, onClose, onSave }) => {
  const [data, setData] = useState({ ...initial });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!data.assetTag) return toast.error('رقم العهده مطلوب');
    onSave(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-lg">{initial.id ? 'تعديل عهده' : 'إضافة عهده جديده'}</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3 text-sm">
          <Input label="رقم العهده *" value={data.assetTag} onChange={(v) => set('assetTag', v)} />
          <Input label="رقم اودو (Odoo)" value={data.odooNumber} onChange={(v) => set('odooNumber', v)} />
          <Select label="التصنيف" value={data.categoryId} onChange={(v) => set('categoryId', v)}>
            <option value="">— اختر —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
          </Select>
          <Input label="الرقم التسلسلي" value={data.serialNumber} onChange={(v) => set('serialNumber', v)} />
          <Input label="لون الجهاز" value={data.deviceColor} onChange={(v) => set('deviceColor', v)} />
          <Input label="السعر (ر.س)" type="number" value={data.purchasePrice} onChange={(v) => set('purchasePrice', v)} />
          <Input label="تاريخ الشراء" type="date" value={data.purchaseDate} onChange={(v) => set('purchaseDate', v)} />
          <InvoiceUpload value={data.invoiceFile} onChange={(v) => set('invoiceFile', v)} className="col-span-2" />
          <Select label="الحالة" value={data.status} onChange={(v) => set('status', v)}>
            {FORM_STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select label="حالة الجهاز" value={data.condition} onChange={(v) => set('condition', v)}>
            {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <LocationField
            value={data.location}
            onChange={(v) => set('location', v)}
            className="col-span-2"
          />

          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">المواصفات (CPU / RAM / Storage / إلخ)</label>
            <textarea
              value={data.specifications || ''}
              onChange={(e) => set('specifications', e.target.value)}
              rows="2"
              placeholder="مثال: Intel Core i7 · RAM 16GB · SSD 512GB · Windows 11 Pro"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            />
          </div>

          {!isEditing && (
            <div className="col-span-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900 space-y-2">
              <label className="text-xs text-green-700 dark:text-green-400 font-semibold mb-1 block">
                تسليم لموظف (اختياري)
              </label>
              <select
                value={data.currentUserId || ''}
                onChange={(e) => set('currentUserId', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value="">— بدون تسليم (سيكون متاح) —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.department ? `· ${u.department}` : ''} {u.email ? `(${u.email})` : ''}
                  </option>
                ))}
              </select>

              {data.currentUserId && (
                <div className="mt-2">
                  <label className="text-xs text-green-700 dark:text-green-400 font-semibold mb-1 block">
                    تاريخ التسليم
                  </label>
                  <input
                    type="date"
                    value={data.assignmentDate || ''}
                    onChange={(e) => set('assignmentDate', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  />
                  <p className="text-[10px] text-green-700 dark:text-green-400 mt-1">
                    لو تركته فاضي، يستخدم تاريخ اليوم تلقائياً.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">ملاحظات</label>
            <textarea
              value={data.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              rows="2"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
            إلغاء
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold">
            حفظ
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

const Input = ({ label, value, onChange, type = 'text', className = '' }) => (
  <div className={className}>
    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
    />
  </div>
);

const InvoiceUpload = ({ value, onChange, className = '' }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('invoice', file);
      const res = await axios.post('/api/assets/upload-invoice', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url);
      toast.success('تم رفع الفاتورة');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل رفع الفاتورة');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-1 block">فاتورة الجهاز (PDF / صورة)</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {uploading ? 'جاري الرفع...' : value ? 'تغيير الملف' : 'رفع فاتورة'}
        </button>
        {value && (
          <>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary-600 hover:underline truncate flex-1"
              title={value}
            >
              {value.split('/').pop()}
            </a>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-red-500 hover:underline"
            >
              حذف
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/*"
          onChange={handleFile}
        />
      </div>
    </div>
  );
};

const LocationField = ({ value, onChange, className = '' }) => {
  const presetNames = LOCATION_PRESETS.map(p => p.name);
  const isPreset = !value || presetNames.includes(value);
  const [customMode, setCustomMode] = useState(!isPreset);
  const codeForCurrent = codeForLocation(value);

  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-1 block">
        الموقع {codeForCurrent && <span className="text-primary-600 font-mono">[{codeForCurrent}]</span>}
      </label>
      {!customMode ? (
        <select
          value={value || ''}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setCustomMode(true);
              onChange('');
            } else {
              onChange(e.target.value);
            }
          }}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
        >
          <option value="">— اختر موقع —</option>
          {LOCATION_PRESETS.map(loc => (
            <option key={loc.name} value={loc.name}>{loc.name} ({loc.code})</option>
          ))}
          <option value="__custom__">+ موقع آخر…</option>
        </select>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="اكتب موقع مخصص"
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            autoFocus
          />
          <button
            type="button"
            onClick={() => { setCustomMode(false); onChange(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2"
            title="استخدم القائمة"
          >
            ← قائمة
          </button>
        </div>
      )}
    </div>
  );
};

const Select = ({ label, value, onChange, children, className = '' }) => (
  <div className={className}>
    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
    >
      {children}
    </select>
  </div>
);

const CategoriesModal = ({ categories, onClose, onChange }) => {
  const [list, setList] = useState(categories);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');

  useEffect(() => { setList(categories); }, [categories]);

  const add = async () => {
    if (!name) return toast.error('الاسم مطلوب');
    try {
      await axios.post('/api/assets/categories', { name, nameAr });
      setName(''); setNameAr('');
      toast.success('تم الإضافة');
      onChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('حذف التصنيف؟')) return;
    try {
      await axios.delete(`/api/assets/categories/${id}`);
      toast.success('تم الحذف');
      onChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold">إدارة التصنيفات</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <input
              placeholder="الاسم (إنجليزي)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            />
            <input
              placeholder="الاسم (عربي)"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            />
            <button onClick={add} className="bg-primary-600 text-white px-3 rounded-lg">
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-2">
            {list.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">لا توجد تصنيفات بعد</p>
            )}
            {list.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/40 p-2 rounded">
                <span className="text-sm">{c.nameAr || c.name}</span>
                <button onClick={() => remove(c.id)} className="text-red-500 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ExportDropdown = ({ onExportSelected, onExportFiltered, onExportAll, onExportPTouch, selectedCount, filteredCount, totalCount }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-gray-50"
      >
        <Download size={16} />
        تصدير
      </button>
      {open && (
        <div className="absolute mt-1 left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
          {selectedCount > 0 && (
            <button
              onMouseDown={onExportSelected}
              className="w-full text-right px-4 py-3 text-sm bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-b border-gray-100 dark:border-gray-700"
            >
              <div className="font-semibold text-green-700 dark:text-green-400">✅ تصدير المحدّد</div>
              <div className="text-xs text-green-600 dark:text-green-500">{selectedCount} عهدة تم تحديدها</div>
            </button>
          )}
          <button
            onMouseDown={onExportFiltered}
            className="w-full text-right px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
          >
            <div className="font-semibold">📋 تصدير المعروض</div>
            <div className="text-xs text-gray-500">{filteredCount} أصل (مع الفلاتر)</div>
          </button>
          <button
            onMouseDown={onExportAll}
            className="w-full text-right px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
          >
            <div className="font-semibold">📦 تصدير كل العهد</div>
            <div className="text-xs text-gray-500">{totalCount} أصل (بدون فلاتر)</div>
          </button>
          <button
            onMouseDown={onExportPTouch}
            className="w-full text-right px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <div className="font-semibold">🖨️ CSV لطابعة P-Touch</div>
            <div className="text-xs text-gray-500">
              {selectedCount > 0 ? `${selectedCount} محدّد` : `${filteredCount} معروض`} — للاستيراد في Brother
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

const ByUserModal = ({ users, selectedUserId, data, exporterInfo, onSelectUser, onClose, onPrintLabel }) => {
  const handleExportEmployee = () => {
    if (!data || !data.currentAssets.length) {
      toast.error('لا توجد عهد لهذا الموظف');
      return;
    }
    const fileName = `mab-assets-${(data.user.name || 'employee').replace(/\s+/g, '-')}.xls`;
    exportAssetsToExcel(data.currentAssets, fileName, `عهد ${data.user.name}`, exporterInfo);
    toast.success(`تم تصدير عهد ${data.user.name}`);
  };
  const handlePrintEmployeeLabels = () => {
    if (!data || !data.currentAssets.length) return;
    printMultipleLabels(data.currentAssets);
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <User size={18} /> عرض العهد حسب الموظف
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold mb-2 block">اختر الموظف</label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => onSelectUser(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            >
              <option value="">— اختر موظف —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.department ? `· ${u.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          {data && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-lg">{data.user.name}</p>
                    <p className="text-xs text-gray-500">
                      {data.user.email} · {data.user.department || 'بدون قسم'} · {data.user.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">العهد الحالية</p>
                    <p className="text-2xl font-bold text-blue-600">{data.currentAssets.length}</p>
                  </div>
                </div>
                {data.currentAssets.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={handleExportEmployee}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download size={14} />
                      تصدير ملف العهد
                    </button>
                    <button
                      onClick={handlePrintEmployeeLabels}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Tag size={14} />
                      طباعة كل الملصقات
                    </button>
                  </div>
                )}
              </div>

              {/* Current assets */}
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Package size={16} />
                  العهد الحالية ({data.currentAssets.length})
                </h3>
                {data.currentAssets.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 dark:bg-gray-900/40 rounded">
                    لا توجد عهد مسجّلة باسم هذا الموظف
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.currentAssets.map(a => (
                      <div key={a.id} className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{a.assetTag}</span>
                            <span className="text-sm font-semibold truncate">
                              {[a.brand, a.model].filter(Boolean).join(' ') || a.Category?.nameAr || 'أصل'}
                            </span>
                          </div>
                          {a.serialNumber && (
                            <p className="text-[11px] text-gray-500 mt-1 font-mono">S/N: {a.serialNumber}</p>
                          )}
                        </div>
                        <button
                          onClick={() => onPrintLabel(a)}
                          className="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 p-1.5 rounded"
                          title="طباعة ملصق"
                        >
                          <Tag size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History */}
              {data.history.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Calendar size={16} />
                    سجل العهد السابقة
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.history.filter(h => h.returnedAt).slice(0, 10).map(h => (
                      <div key={h.id} className="text-xs bg-gray-50 dark:bg-gray-900/40 p-2 rounded flex justify-between">
                        <span>
                          {h.Asset?.assetTag} — {[h.Asset?.brand, h.Asset?.model].filter(Boolean).join(' ')}
                        </span>
                        <span className="text-gray-500">
                          {new Date(h.assignedAt).toLocaleDateString('ar-EG')}
                          {' → '}
                          {new Date(h.returnedAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Assets;
