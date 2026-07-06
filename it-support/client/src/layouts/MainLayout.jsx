import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import { LayoutDashboard, Ticket, Users, LogOut, Menu, X, Moon, Sun, Bell, HelpCircle, Archive, Trash2, Laptop, Package, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MainLayout = () => {
  // Default: open on desktop, closed on mobile (<768px)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true); // always open on desktop
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { user, logout, refreshProfile } = useAuth();
  const location = useLocation();
  const socket = useSocket();

  // When admin updates this user's permissions, refresh profile so the new
  // sidebar items appear without requiring a manual page refresh / re-login.
  useEffect(() => {
    if (!socket) return;
    const onPerms = () => {
      refreshProfile?.();
      toast('تم تحديث صلاحياتك — الواجهة تحدّثت تلقائياً', { icon: '🔓', duration: 5000 });
    };
    socket.on('permissions_updated', onPerms);
    return () => socket.off('permissions_updated', onPerms);
  }, [socket]);

  const [notifications, setNotifications] = useState([
    { id: '1', title: 'تم تفعيل الحساب بنجاح 🔐', message: 'مرحباً بك في منصة MAP UNITED للدعم الفني. حسابك الآن نشط بالكامل.', time: 'منذ قليل', isRead: false },
    { id: '2', title: '💡 تلميح الدعم الفني', message: 'تصفح قسم "المشاكل الشائعة" للحصول على حلول سريعة وفورية للمشاكل المتكررة.', time: 'اليوم', isRead: true }
  ]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const playNotifSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  const addNotification = (title, message) => {
    playNotifSound();
    const newNotif = {
      id: Date.now().toString(),
      title,
      message,
      time: 'الآن',
      isRead: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    toast.success(`${title}: ${message}`, { duration: 4000, icon: '🔔' });
  };

  useEffect(() => {
    if (!socket) return;

    // Dedupe events that arrive twice (e.g., user in both ticket_room and user_room)
    const seenEvents = new Map();
    const isDuplicate = (key) => {
      const now = Date.now();
      const last = seenEvents.get(key);
      if (last && now - last < 1500) return true;
      seenEvents.set(key, now);
      // cleanup old entries
      if (seenEvents.size > 200) {
        for (const [k, v] of seenEvents) {
          if (now - v > 5000) seenEvents.delete(k);
        }
      }
      return false;
    };

    const onNewTicket = (ticket) => {
      if (ticket?._silent) return; // accompanying ticket emitted from registration flow
      if (isDuplicate(`nt-${ticket.id}`)) return;
      if (['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role)) {
        addNotification('طلب دعم جديد 📝', `تم استلام طلب جديد بعنوان "${ticket.title}"`);
      }
    };
    const onNewUserReg = () => {
      if (isDuplicate(`reg-${Date.now() >> 10}`)) return;
      if (['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role)) {
        addNotification('طلب تسجيل موظف 👤', 'سجل موظف جديد بانتظار تفعيل حسابه.');
      }
    };
    const onTicketUpdated = (ticket) => {
      if (isDuplicate(`tu-${ticket.id}-${ticket.status}-${ticket.billingStatus || ''}`)) return;
      if (user?.role === 'EMPLOYEE' && ticket.employeeId === user.id) {
        addNotification('تحديث الطلب 🔄', `تم تحديث حالة طلبك "${ticket.title}"`);
      }
    };
    const onReplyHint = (data) => {
      if (isDuplicate(`rh-${data.ticketId}-${Date.now() >> 10}`)) return;
      addNotification('رد جديد 💬', `رد جديد على طلبك "${data.title}"`);
    };

    socket.on('new_ticket', onNewTicket);
    socket.on('new_user_registration', onNewUserReg);
    socket.on('ticket_updated', onTicketUpdated);
    socket.on('reply_hint', onReplyHint);

    return () => {
      socket.off('new_ticket', onNewTicket);
      socket.off('new_user_registration', onNewUserReg);
      socket.off('ticket_updated', onTicketUpdated);
      socket.off('reply_hint', onReplyHint);
    };
  }, [socket, user]);

  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
    const savedZoom = localStorage.getItem('zoomLevel');
    if (savedZoom) {
      setZoomLevel(parseInt(savedZoom, 10));
    }
  }, []);

  const adjustZoom = (amount) => {
    setZoomLevel(prev => {
      const nextZoom = Math.min(Math.max(prev + amount, 76), 140);
      localStorage.setItem('zoomLevel', nextZoom);
      document.documentElement.style.fontSize = `${nextZoom}%`;
      return nextZoom;
    });
  };

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDarkMode(!isDarkMode);
  };

  const navItems = [
    { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPER_ADMIN', 'IT_SUPPORT'] },
    { name: 'المشاكل الشائعة', path: '/dashboard/faq', icon: HelpCircle, roles: ['EMPLOYEE'] },
    { name: 'الطلبات', path: '/dashboard/tickets', icon: Ticket, roles: ['ADMIN', 'SUPER_ADMIN', 'IT_SUPPORT', 'EMPLOYEE'] },
    { name: 'عهدتي', path: '/dashboard/my-assets', icon: Laptop, roles: ['EMPLOYEE', 'IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'] },
    {
      name: 'إدارة العهد', path: '/dashboard/assets', icon: Package,
      roles: ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'],
      permissions: ['ASSET_CREATE', 'ASSET_EDIT', 'ASSET_DELETE', 'ASSET_ASSIGN'],
    },
    { name: 'أرشيف الإدارة', path: '/dashboard/archive', icon: Archive, roles: ['ADMIN', 'SUPER_ADMIN'] },
    {
      name: 'المستخدمين', path: '/dashboard/users', icon: Users,
      roles: ['ADMIN', 'SUPER_ADMIN', 'IT_SUPPORT'],
      permissions: ['USER_CREATE', 'USER_DELETE', 'USER_RESET_PW'],
    },
    {
      name: 'سجل النشاط', path: '/dashboard/security-logs', icon: Shield,
      roles: ['ADMIN', 'SUPER_ADMIN'],
      permissions: ['VIEW_LOGS'],
    },
    {
      name: 'سلة المحذوفات', path: '/dashboard/trash', icon: Trash2,
      roles: ['ADMIN', 'SUPER_ADMIN', 'IT_SUPPORT'],
      permissions: ['VIEW_TRASH'],
    },
  ];

  // Show a nav item if the user has the role OR any of the listed permissions.
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
  const allowedNavItems = navItems.filter(item => {
    if (item.roles?.includes(user?.role)) return true;
    if (item.permissions?.some(p => userPerms.includes(p))) return true;
    return false;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Slide-out Notification Drawer */}
      <AnimatePresence>
        {isNotifOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotifOpen(false)}
              className="fixed inset-0 bg-black/35 backdrop-blur-sm z-40"
            />
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 w-80 sm:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-primary-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={20} />
                  <span className="font-bold text-sm">الإشعارات والتنبيهات</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
                      toast.success('تم تحديد الكل كمقروء');
                    }}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors text-white"
                  >
                    قراءة الكل
                  </button>
                  <button 
                    onClick={() => setIsNotifOpen(false)}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      onClick={() => {
                        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        notif.isRead 
                          ? 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/50 opacity-75' 
                          : 'bg-primary-50/30 dark:bg-primary-950/10 border-primary-100 dark:border-primary-950/20 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-sm font-bold ${notif.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-primary-800 dark:text-primary-400'}`}>
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="w-2.5 h-2.5 rounded-full bg-primary-600 shrink-0 mt-1"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-gray-400 block mt-2">{notif.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Bell size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">لا توجد إشعارات حالياً</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Mobile backdrop — closes sidebar on tap */}
      <AnimatePresence>
        {isSidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className={`w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-lg ${
              isMobile
                ? 'fixed inset-y-0 right-0 z-40'
                : 'relative z-20'
            }`}
          >
            <div className="p-6 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
              <img src="/logo.png" alt="MAB UNITED Logo" className="h-10 object-contain" />
            </div>

            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => { if (isMobile) setIsSidebarOpen(false); }}
                    className={`flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-semibold shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {(() => {
                const roleConfig = {
                  EMPLOYEE: { label: 'موظف', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300', avatar: 'bg-sky-500' },
                  IT_SUPPORT: { label: 'دعم فني', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', avatar: 'bg-amber-500' },
                  ADMIN: { label: 'إداري', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', avatar: 'bg-emerald-500' },
                  SUPER_ADMIN: { label: '1', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', avatar: 'bg-rose-500' },
                };
                const cfg = roleConfig[user?.role] || roleConfig.EMPLOYEE;
                return (
                  <div className="flex items-center space-x-3 space-x-reverse mb-4">
                    <div className={`w-10 h-10 rounded-full ${cfg.avatar} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                      {user?.name?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold dark:text-white truncate">{user?.name}</p>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <button
                onClick={logout}
                className="flex items-center space-x-2 space-x-reverse text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full px-4 py-2 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        {/* Navbar */}
        <header className="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 sm:px-6 z-10 gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsNotifOpen(true)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
            >
              <Bell size={20} />
              {notifications.some(n => !n.isRead) && (
                <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border border-white dark:border-gray-800">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Zoom Controls — hidden on mobile */}
            <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-900/60 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => adjustZoom(-8)}
                className="p-1.5 px-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 rounded-md transition-all shadow-sm"
                title="تصغير الخط / الشاشة"
              >
                A-
              </button>
              <span className="px-2 text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300 min-w-[38px] text-center select-none">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(8)}
                className="p-1.5 px-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 rounded-md transition-all shadow-sm"
                title="تكبير الخط / الشاشة"
              >
                A+
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
        <footer className="px-6 py-2 text-center text-[10px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800/40">
          © 2026 IT.MAB. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;
