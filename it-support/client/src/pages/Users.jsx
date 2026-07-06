import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, Search, RefreshCw, UserCheck, Shield, 
  UserPlus, Key, Trash2, X, Eye, EyeOff, ChevronRight, ChevronLeft 
} from 'lucide-react';
import toast from 'react-hot-toast';

const Users = () => {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const socket = useSocket();

  // Password visibility map
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionsTarget, setPermissionsTarget] = useState(null);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [permissionsSelection, setPermissionsSelection] = useState(new Set());
  const [savingPerms, setSavingPerms] = useState(false);
  const isAdminUser = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    department: 'الموارد البشرية',
    location: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // After creating a user, hold the auto-generated password to show admin once
  const [newCredentials, setNewCredentials] = useState(null);
  // Helper: is the current user the SUPER_ADMIN themselves?
  const isSelf = (u) => u && u.id === user?.id;
  // Hide reveal/edit/delete buttons for SUPER_ADMIN targets that aren't self
  const isProtectedSA = (u) => u?.role === 'SUPER_ADMIN' && !isSelf(u);

  // Helpers: role OR permission unlocks each capability
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isPrivilegedRole = ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const canCreate = isPrivilegedRole || userPerms.includes('USER_CREATE');
  const canDelete = isPrivilegedRole || userPerms.includes('USER_DELETE');
  const canResetPw = isPrivilegedRole || userPerms.includes('USER_RESET_PW');
  const canDoAnything = canCreate || canDelete || canResetPw;

  const isPasswordStrong = (pass) => {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(pass);
    const hasLowercase = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecialChar = /[@$!%*?&#]/.test(pass);
    return pass.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  };

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users');
      setUsersList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setUsersList([]);
      if (error?.response?.status !== 401) {
        toast.error('خطأ في تحميل قائمة الموظفين');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onDeleted = ({ id }) => {
      setUsersList(prev => prev.filter(u => u.id !== id));
    };
    const onCreatedOrActivated = () => {
      fetchUsers();
    };

    socket.on('new_user_registration', onCreatedOrActivated);
    socket.on('user_created', onCreatedOrActivated);
    socket.on('user_activated', onCreatedOrActivated);
    socket.on('user_deleted', onDeleted);

    return () => {
      socket.off('new_user_registration', onCreatedOrActivated);
      socket.off('user_created', onCreatedOrActivated);
      socket.off('user_activated', onCreatedOrActivated);
      socket.off('user_deleted', onDeleted);
    };
  }, [socket]);

  const handleActivate = async (userId) => {
    // Optimistic: update local state immediately
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isActive: true } : u));
    try {
      const res = await axios.put(`/api/users/${userId}/activate`);
      const { tempCode } = res.data;
      // Show temp code prominently if returned
      if (tempCode) {
        toast.success(` تم التفعيل! الرمز المؤقت: ${tempCode}`, { duration: 8000 });
      } else {
        toast.success('تم تفعيل حساب الموظف بنجاح ');
      }
      fetchUsers(); // refresh to get temporaryCode shown on card
    } catch (error) {
      // Rollback on failure
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isActive: false } : u));
      toast.error(error.response?.data?.message || 'خطأ في تفعيل الحساب');
    }
  };

  // Add Employee handler — password is generated server-side
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) {
      return toast.error('يرجى إدخال الاسم والبريد الإلكتروني');
    }

    try {
      setSubmitting(true);
      // Don't send password — backend generates it
      const { password, ...payload } = addForm;
      const res = await axios.post('/api/users', payload);
      toast.success(res.data.message || 'تم إضافة الموظف بنجاح');
      setIsAddModalOpen(false);
      // Surface the generated password to the admin so they can hand it over
      if (res.data.generatedPassword) {
        setNewCredentials({
          email: addForm.email,
          name: addForm.name,
          password: res.data.generatedPassword,
        });
      }
      setAddForm({
        name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        department: 'الموارد البشرية',
        location: '',
      });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل إضافة الموظف الجديد');
    } finally {
      setSubmitting(false);
    }
  };

  // Change Password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!isPasswordStrong(newPassword)) {
      return toast.error('يجب أن تكون كلمة المرور قوية جداً: 8 خانات على الأقل، تحتوي على حرف كبير (A-Z)، حرف صغير (a-z)، رقم (0-9)، ورمز خاص مثل (@$!%*?&)');
    }

    try {
      setSubmitting(true);
      const res = await axios.put(`/api/users/${selectedUser.id}/password`, { password: newPassword });
      toast.success(res.data.message || 'تم تحديث الرمز السري بنجاح');
      setIsPassModalOpen(false);
      setNewPassword('');
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل تحديث الرمز السري');
    } finally {
      setSubmitting(false);
    }
  };

  // Permissions handlers
  const openPermissionsModal = async (u) => {
    setPermissionsTarget(u);
    setPermissionsSelection(new Set(Array.isArray(u.permissions) ? u.permissions : []));
    if (permissionsCatalog.length === 0) {
      try {
        const res = await axios.get('/api/users/permissions/catalog');
        setPermissionsCatalog(Array.isArray(res.data?.permissions) ? res.data.permissions : []);
      } catch (err) {
        toast.error('فشل تحميل قائمة الصلاحيات');
      }
    }
  };
  const togglePermission = (key) => {
    setPermissionsSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const savePermissions = async () => {
    if (!permissionsTarget) return;
    try {
      setSavingPerms(true);
      await axios.put(`/api/users/${permissionsTarget.id}/permissions`, {
        permissions: Array.from(permissionsSelection),
      });
      toast.success('تم حفظ الصلاحيات');
      setPermissionsTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحفظ');
    } finally {
      setSavingPerms(false);
    }
  };

  // Delete User handler
  const handleDeleteUser = async (u) => {
    if (u.id === user.id) {
      return toast.error('لا يمكنك حذف حسابك الشخصي!');
    }

    if (!window.confirm(`هل أنت متأكد من حذف حساب الموظف "${u.name}" نهائياً من النظام؟`)) {
      return;
    }

    // Optimistic: remove immediately from UI
    setUsersList(prev => prev.filter(emp => emp.id !== u.id));

    try {
      await axios.delete(`/api/users/${u.id}`);
      toast.success(`تم حذف حساب "${u.name}" بنجاح`);
      // Confirm consistency with server state
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل حذف الموظف - جاري الاسترجاع');
      fetchUsers();
    }
  };

  // Filter Logic
  const filteredUsers = usersList.filter(u => {
    return (
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / PER_PAGE) || 1;
  const indexOfLastItem = currentPage * PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - PER_PAGE;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'U';
  };

  const roleMap = {
    'ADMIN': 'إداري',
    'SUPER_ADMIN': '.',
    'IT_SUPPORT': 'دعم فني',
    'EMPLOYEE': 'موظف'
  };

  const depts = ['الموارد البشرية', 'المشتريات', 'المحاسبة', 'التسويق', 'ميكانيكي', 'كهربائي', 'تقنية المعلومات','منسق', 'الإدارة'];
  const locations = ['القدية', 'الدرعية', 'المقر الرئيسي'];

  return (
    <div className="space-y-6">
      {/* Top Header Row with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700/60 pb-5">
        <div>
          <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            إدارة الموظفين والحسابات
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            مراجعة وتفعيل الحسابات وإضافة الموظفين والتحكم الكامل بالصلاحيات والرموز السرية
          </p>
        </div>

        {/* Add Employee Button placed at the very top header */}
        {canCreate && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-1.5 shadow-md shrink-0 sm:self-start mt-2"
          >
            <UserPlus size={16} />
            إضافة موظف جديد
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex justify-end items-center gap-3">
        {/* Search Box */}
        <div className="relative">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="بحث بالاسم، البريد أو القسم..."
            className="input-field pr-9 py-1.5 text-xs w-60"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Refresh */}
        <button 
          onClick={fetchUsers}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          title="تحديث البيانات"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card h-44 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
          ))}
        </div>
      ) : currentUsers.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Shield size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">لا توجد حسابات متطابقة حالياً.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card Grid Layout (#empGrid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="empGrid">
            {currentUsers.map((u, idx) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="card flex flex-col justify-between border-t-4 border-primary-500 hover:shadow-lg transition-all duration-200 relative overflow-hidden"
              >
                {/* Status Badges */}
                <div className="absolute left-4 top-4 flex gap-1">
                  {u.isActive ? (
                    <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-950/20 border border-green-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      <CheckCircle size={10} /> نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                      <XCircle size={10} /> معلق / غير نشط
                    </span>
                  )}
                </div>

                <div className="flex gap-4 items-start pr-2 mt-2">
                  {/* Initials Avatar */}
                  <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {getInitials(u.name)}
                  </div>
                  <div className="space-y-1 w-full">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{u.name}</h4>
                    <p className="text-[10px] text-gray-400 font-semibold">{u.email}</p>
                    
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-[9px] font-bold">
                         {u.department || 'بدون قسم'}
                      </span>
                      {u.location && (
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 rounded text-[9px] font-bold">
                           {u.location}
                        </span>
                      )}
                      {(() => {
                        const roleColors = {
                          EMPLOYEE: 'bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400',
                          IT_SUPPORT: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
                          ADMIN: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400',
                          SUPER_ADMIN: 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400',
                        };
                        const cls = roleColors[u.role] || roleColors.EMPLOYEE;
                        return (
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${cls}`}>
                             {roleMap[u.role] || u.role}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/50 space-y-1">
                      {isProtectedSA(u) ? (
                        <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1.5 rounded border border-rose-200 dark:border-rose-900/40">
                          1
                        </div>
                      ) : u.temporaryCode ? (
                        <div className="text-[11px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 px-2.5 py-1.5 rounded border border-yellow-200 dark:border-yellow-900/40">
                           رمز التفعيل النشط: <span className="font-mono text-xs">{visiblePasswords[u.id] ? u.temporaryCode : '••••••'}</span>
                        </div>
                      ) : u.plainPassword ? (
                        <div className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2.5 py-1.5 rounded border border-green-200 dark:border-green-950/40">
                           الرمز السري: <span className="font-mono text-xs">{visiblePasswords[u.id] ? u.plainPassword : '••••••••'}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700/40">
                           الرمز السري: <span className="font-mono">غير متوفر (لم يتم تعيين رمز بعد)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="border-t border-gray-100 dark:border-gray-700/60 pt-4 mt-6 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {/* Action buttons — hidden entirely for protected SUPER_ADMIN accounts */}
                    {!isProtectedSA(u) && canDoAnything && (
                      <>
                        {canResetPw && (
                          <button
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded transition-colors"
                            title={visiblePasswords[u.id] ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
                          >
                            {visiblePasswords[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}

                        {canResetPw && (
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setIsPassModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded transition-colors"
                            title="تعديل الرمز السري"
                          >
                            <Key size={14} />
                          </button>
                        )}

                        {isAdminUser && (
                          <button
                            onClick={() => openPermissionsModal(u)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded transition-colors"
                            title="الصلاحيات الخاصة"
                          >
                            <Shield size={14} />
                          </button>
                        )}

                        {canDelete && u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                            title="حذف الموظف"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {!u.isActive ? (
                    canCreate ? (
                      <button
                        onClick={() => handleActivate(u.id)}
                        className="btn-primary py-1 px-2.5 text-[10px] font-bold flex items-center gap-1 hover:bg-primary-700 transition-colors shadow-sm"
                      >
                        <UserCheck size={10} />
                        تفعيل الموظف
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-semibold">تحتاج صلاحية للتفعيل</span>
                    )
                  ) : (
                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                       مفعّل ومكتمل
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination Row (Item 4 - Arrow based pagination) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700/50 mt-6">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                عرض {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, filteredUsers.length)} من {filteredUsers.length} حساب
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="p-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 flex items-center gap-1"
                >
                  <ChevronRight size={14} />
                  السابق
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-7.5 h-7.5 rounded text-xs font-bold border transition-all ${
                      currentPage === page
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="p-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 flex items-center gap-1"
                >
                  التالي
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal - Safe positioning top-10 with max-height to never cut off (Item 1 & 3) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-10 max-h-[85vh] overflow-y-auto md:max-w-md md:mx-auto md:left-1/2 md:-translate-x-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 border border-gray-200 dark:border-gray-700 flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-primary-600 text-white flex items-center justify-between">
                <h3 className="font-bold text-sm">إضافة حساب موظف جديد</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:bg-white/10 p-1 rounded">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">الاسم الكامل للموظف *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: المهند علي حمود محنشي "
                    className="input-field text-xs py-2"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    required
                    placeholder="example@mab.com"
                    className="input-field text-xs py-2 text-left"
                    value={addForm.email}
                    onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs p-3 rounded-lg leading-relaxed">
                   سيتم توليد <b>كلمة مرور قوية تلقائياً</b> وعرضها لك بعد الحفظ.
                  أعطها للموظف مع بريده — وسيُطلب منه تغييرها عند أول تسجيل دخول.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300">القسم</label>
                    <select
                      className="input-field text-xs py-2"
                      value={addForm.department}
                      onChange={e => setAddForm({ ...addForm, department: e.target.value })}
                    >
                      {depts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300">الموقع</label>
                    <select
                      className="input-field text-xs py-2"
                      value={addForm.location || ''}
                      onChange={e => setAddForm({ ...addForm, location: e.target.value })}
                    >
                      <option value="">— اختر —</option>
                      {locations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300">الصلاحية</label>
                    <select
                      className="input-field text-xs py-2"
                      value={addForm.role}
                      onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                    >
                      <option value="EMPLOYEE">موظف (Employee)</option>
                      <option value="IT_SUPPORT">دعم فني (IT)</option>
                      <option value="ADMIN">أدمن (Admin)</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-secondary text-xs py-2 px-4 font-bold">
                    إلغاء
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary text-xs py-2 px-4 font-bold disabled:opacity-50">
                    {submitting ? 'جاري الإضافة...' : 'حفظ الموظف الجديد'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isPassModalOpen && selectedUser && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPassModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:max-w-sm md:mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-primary-600 text-white flex items-center justify-between">
                <h3 className="font-bold text-sm">تعديل الرمز السري للموظف</h3>
                <button onClick={() => setIsPassModalOpen(false)} className="text-white hover:bg-white/10 p-1 rounded">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  سيتم تغيير الرمز السري للموظف <strong className="text-gray-800 dark:text-white">"{selectedUser.name}"</strong> مباشرة في قاعدة البيانات.
                </div>
                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">الرمز السري الجديد *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="أدخل 6 أحرف أو أكثر..."
                      className="input-field text-xs py-2 text-left pl-10"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsPassModalOpen(false)} className="btn-secondary text-xs py-2 px-4 font-bold">
                    إلغاء
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary text-xs py-2 px-4 font-bold disabled:opacity-50">
                    {submitting ? 'جاري التعديل...' : 'تحديث الرمز السري'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Generated credentials modal — shown once after creating a user */}
      <AnimatePresence>
        {newCredentials && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setNewCredentials(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl"
              >
                <div className="text-center mb-5">
                  <div className="text-5xl mb-3"></div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                    تم إنشاء الحساب بنجاح
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    سلّم هذه البيانات للموظف. سيُطلب منه تغيير كلمة المرور عند أول دخول.
                  </p>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg">
                    <p className="text-[11px] text-gray-500 mb-1">الاسم</p>
                    <p className="font-semibold text-sm">{newCredentials.name}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg">
                    <p className="text-[11px] text-gray-500 mb-1">البريد الإلكتروني</p>
                    <p className="font-mono text-sm select-all" dir="ltr">{newCredentials.email}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 p-3 rounded-lg">
                    <p className="text-[11px] text-green-700 dark:text-green-400 mb-1 font-bold">كلمة المرور المؤقتة</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-base font-bold text-green-700 dark:text-green-400 select-all" dir="ltr">
                        {newCredentials.password}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(newCredentials.password);
                          toast.success('تم النسخ');
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-bold"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] p-2.5 rounded mb-4">
                   هذه آخر مرة تظهر فيها كلمة المرور بهذا الشكل. احفظها أو سلّمها للموظف الآن.
                </div>

                <button
                  type="button"
                  onClick={() => setNewCredentials(null)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 rounded-lg"
                >
                  تم
                </button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Permissions Modal */}
      <AnimatePresence>
        {permissionsTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPermissionsTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-indigo-600 text-white">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Shield size={18} /> صلاحيات خاصة
                </h3>
                <p className="text-xs mt-1 opacity-90">
                  {permissionsTarget.name} · {permissionsTarget.email}
                </p>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-xs p-3 rounded-lg mb-4 leading-relaxed">
                  💡 الصلاحيات هنا <b>إضافية</b> على دور الموظف. مثلاً: يمكن إعطاء موظف عادي
                  صلاحية إضافة عهدة بدون ما تغيّر دوره.
                </div>

                {permissionsCatalog.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">جاري التحميل...</div>
                ) : (
                  Object.entries(
                    permissionsCatalog.reduce((acc, p) => {
                      const g = p.group || 'عام';
                      (acc[g] = acc[g] || []).push(p);
                      return acc;
                    }, {})
                  ).map(([group, perms]) => (
                    <div key={group} className="mb-4">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">{group}</h4>
                      <div className="space-y-1.5">
                        {perms.map((p) => (
                          <label
                            key={p.key}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/40"
                          >
                            <input
                              type="checkbox"
                              checked={permissionsSelection.has(p.key)}
                              onChange={() => togglePermission(p.key)}
                              className="w-4 h-4 accent-indigo-600"
                            />
                            <span className="text-sm">{p.label}</span>
                            <span className="text-[10px] font-mono text-gray-400 mr-auto">{p.key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
                <button
                  onClick={() => setPermissionsTarget(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                >
                  إلغاء
                </button>
                <button
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  {savingPerms ? 'جاري الحفظ...' : `حفظ (${permissionsSelection.size})`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated credentials modal */}
      {/* ... */}
    </div>
  );
};

export default Users;
