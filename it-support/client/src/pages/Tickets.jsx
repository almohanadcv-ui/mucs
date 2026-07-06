import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, Clock, CheckCircle, AlertCircle,
  Send, Paperclip, X, User, RefreshCw, ChevronRight, ChevronLeft, HelpCircle,
  Maximize2, Minimize2, Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Tickets = () => {
  const { user } = useAuth();

  // Permission helpers
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isPrivilegedRole = ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const canClaimTickets = isPrivilegedRole || userPerms.includes('TICKET_CLAIM');
  const canDeleteTickets = isPrivilegedRole || userPerms.includes('TICKET_DELETE');
  const canApproveInvoices = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role) || userPerms.includes('INVOICE_APPROVE');
  const socket = useSocket();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveDate, setLiveDate] = useState('');

  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, OPEN, IN_PROGRESS, RESOLVED, CLOSED
  const [deptFilter, setDeptFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10; // Exceeds 10 will activate chevrons pagination (Item 4)

  // Selected Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [newReplyMessage, setNewReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Real-time Typing Indicators (Item 6)
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, open: 0, progress: 0, solved: 0 });

  // Update live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLiveDate(
        now.toLocaleString('ar-SA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/tickets');
      const list = Array.isArray(res.data) ? res.data : [];
      setTickets(list);
      calculateStats(list);
    } catch (error) {
      setTickets([]);
      calculateStats([]);
      if (error?.response?.status !== 401) {
        toast.error('خطأ في تحميل التذاكر');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (list) => {
    const arr = Array.isArray(list) ? list : [];
    const total = arr.length;
    const open = arr.filter(t => t.status === 'OPEN').length;
    const progress = arr.filter(t => t.status === 'IN_PROGRESS').length;
    const solved = arr.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    setStats({ total, open, progress, solved });
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Socket rooms & events registration
  useEffect(() => {
    if (socket && selectedTicket) {
      socket.emit('join_ticket_room', selectedTicket.id);
    }
  }, [socket, selectedTicket?.id]);

  // Listen to Sockets
  useEffect(() => {
    if (socket) {
      const handleNewTicket = (ticket) => {
        if (user?.role === 'ADMIN' && ticket.category !== 'BILLING') return;
        if (user?.role === 'IT_SUPPORT' && ticket.category === 'BILLING') return;
        if (user?.role === 'EMPLOYEE' && ticket.employeeId !== user.id) return;

        setTickets(prev => {
          const newList = [ticket, ...prev];
          calculateStats(newList);
          return newList;
        });
      };

      const handleTicketUpdated = (updatedTicket) => {
        if (user?.role === 'ADMIN' && updatedTicket.category !== 'BILLING') {
          setTickets(prev => {
            const newList = prev.filter(t => t.id !== updatedTicket.id);
            calculateStats(newList);
            return newList;
          });
          if (selectedTicket && selectedTicket.id === updatedTicket.id) setSelectedTicket(null);
          return;
        }
        if (user?.role === 'IT_SUPPORT' && updatedTicket.category === 'BILLING') {
          setTickets(prev => {
            const newList = prev.filter(t => t.id !== updatedTicket.id);
            calculateStats(newList);
            return newList;
          });
          if (selectedTicket && selectedTicket.id === updatedTicket.id) setSelectedTicket(null);
          return;
        }

        setTickets(prev => {
          const newList = prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t);
          calculateStats(newList);
          return newList;
        });
        
        if (selectedTicket && selectedTicket.id === updatedTicket.id) {
          if (updatedTicket.status === 'CLOSED' && user?.role === 'EMPLOYEE') {
            setSelectedTicket(null);
            toast.error('تم إغلاق هذا الطلب، ولا يمكنك عرضه الآن.');
          } else {
            fetchTicketDetails(updatedTicket.id);
          }
        }
      };

      const handleNewReply = (reply) => {
        if (selectedTicket && selectedTicket.id === reply.ticketId) {
          setSelectedTicket(prev => {
            const alreadyExists = prev.Replies?.some(r => r.id === reply.id);
            if (alreadyExists) return prev;
            return {
              ...prev,
              Replies: [...(prev.Replies || []), reply]
            };
          });
        }
      };

      // Real-time typing observer
      const handleTypingStatus = ({ ticketId, name, userId, isTyping }) => {
        if (selectedTicket && selectedTicket.id === ticketId && userId !== user.id) {
          setTypingUsers(prev => ({
            ...prev,
            [userId]: isTyping ? name : null
          }));
        }
      };

      const handleTicketDeleted = ({ id }) => {
        setTickets(prev => {
          const newList = prev.filter(t => t.id !== id);
          calculateStats(newList);
          return newList;
        });
        if (selectedTicket && selectedTicket.id === id) {
          setSelectedTicket(null);
          toast('تم حذف هذه التذكرة بواسطة مسؤول آخر', { icon: '🗑️' });
        }
      };

      socket.on('new_ticket', handleNewTicket);
      socket.on('ticket_updated', handleTicketUpdated);
      socket.on('new_reply', handleNewReply);
      socket.on('typing_status', handleTypingStatus);
      socket.on('ticket_deleted', handleTicketDeleted);

      return () => {
        socket.off('new_ticket', handleNewTicket);
        socket.off('ticket_updated', handleTicketUpdated);
        socket.off('new_reply', handleNewReply);
        socket.off('typing_status', handleTypingStatus);
        socket.off('ticket_deleted', handleTicketDeleted);
      };
    }
  }, [socket, selectedTicket, user]);

  // Auto-scroll chat to end on replies length change
  useEffect(() => {
    if (selectedTicket) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.Replies?.length, typingUsers]);

  const fetchTicketDetails = async (id) => {
    try {
      setModalLoading(true);
      const res = await axios.get(`/api/tickets/${id}`);
      setSelectedTicket(res.data);
    } catch (error) {
      toast.error('فشل تحميل تفاصيل التذكرة');
    } finally {
      setModalLoading(false);
    }
  };

  // Typing emitter helper
  const handleReplyChange = (e) => {
    setNewReplyMessage(e.target.value);
    
    if (socket && selectedTicket) {
      socket.emit('typing', { ticketId: selectedTicket.id, name: user.name, userId: user.id });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { ticketId: selectedTicket.id, userId: user.id });
      }, 2500);
    }
  };

  // File addition in replies (max 10 total per reply)
  const handleReplyFilesChange = (e) => {
    setReplyFiles(prev => {
      const merged = [...prev, ...Array.from(e.target.files)];
      if (merged.length > 10) {
        toast.error('الحد الأقصى 10 ملفات لكل رد');
        return merged.slice(0, 10);
      }
      return merged;
    });
  };

  const removeReplyFile = (idx) => {
    setReplyFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Filter Logic
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (ticket.Creator?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'ALL' || 
      ticket.status === statusFilter ||
      (statusFilter === 'RESOLVED' && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'));

    const matchesDept = !deptFilter || (ticket.Creator?.department === deptFilter);
    const matchesCat = !catFilter || (ticket.category === catFilter);

    return matchesSearch && matchesStatus && matchesDept && matchesCat;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredTickets.length / PER_PAGE) || 1;
  const indexOfLastItem = currentPage * PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - PER_PAGE;
  const currentTickets = filteredTickets.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Modal Actions
  const handleUpdateStatus = async (status) => {
    try {
      await axios.put(`/api/tickets/${selectedTicket.id}`, { status });
      toast.success('تم تحديث حالة التذكرة بنجاح');
      fetchTickets();
      setSelectedTicket(prev => ({ ...prev, status }));
    } catch (error) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleAssignToMe = async () => {
    try {
      await axios.put(`/api/tickets/${selectedTicket.id}`, { assignedTo: user.id, status: 'IN_PROGRESS' });
      toast.success('تم تعيين التذكرة إليك وجاري العمل عليها');
      fetchTickets();
      setSelectedTicket(prev => ({
        ...prev,
        assignedTo: user.id,
        status: 'IN_PROGRESS',
        Assignee: { id: user.id, name: user.name }
      }));
    } catch (error) {
      toast.error('فشل التعيين');
    }
  };

  const handleUpdateBillingStatus = async (statusVal) => {
    try {
      setModalLoading(true);
      await axios.put(`/api/tickets/${selectedTicket.id}`, { billingStatus: statusVal });
      toast.success(statusVal === 'APPROVED' ? 'تم قبول الفاتورة بنجاح' : 'تم رفض الفاتورة');
      fetchTickets();
      setSelectedTicket(prev => ({ ...prev, billingStatus: statusVal, status: statusVal === 'APPROVED' ? 'RESOLVED' : 'CLOSED' }));
    } catch (error) {
      toast.error('فشل تحديث حالة الفاتورة');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicket) return;
    const shortId = selectedTicket.id.substring(0, 8);
    if (!window.confirm(`هل أنت متأكد من حذف التذكرة #${shortId} نهائياً؟\nسيتم حذف كل الردود والمرفقات.`)) {
      return;
    }
    try {
      setModalLoading(true);
      await axios.post(`/api/tickets/${selectedTicket.id}/delete`);
      toast.success('تم حذف التذكرة بنجاح');
      // Remove from local list immediately
      setTickets(prev => prev.filter(t => t.id !== selectedTicket.id));
      setSelectedTicket(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'فشل حذف التذكرة');
    } finally {
      setModalLoading(false);
    }
  };

  const exportBillingToExcel = (ticket) => {
    let items = [];
    try {
      const raw = ticket.billingItems;
      if (Array.isArray(raw)) items = raw;
      else if (typeof raw === 'string' && raw.trim()) items = JSON.parse(raw);
      else if (raw && typeof raw === 'object') items = [raw];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      console.error(e);
      items = [];
    }

    if (items.length === 0) {
      items = [{
        amount: ticket.description?.match(/\d+/)?.[0] || '0',
        type: ticket.title || 'فاتورة',
        details: ticket.description || 'لا توجد تفاصيل'
      }];
    }

    // Generate CSV with BOM for Excel Arabic compatibility
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "المبلغ,نوع الفاتورة,التفاصيل\r\n";
    items.forEach(item => {
      csvContent += `"${item.amount}","${item.type}","${item.details}"\r\n`;
    });

    // Append total sum
    const totalSum = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    csvContent += `"${totalSum}","إجمالي المبلغ",""\r\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_فاتورة_${ticket.id.substring(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تحميل ملف Excel بنجاح');
  };

  // Reply Submission with Attachments (Item 7)
  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!newReplyMessage.trim() && replyFiles.length === 0) return;

    try {
      setSubmittingReply(true);
      
      // Stop typing status instantly
      if (socket && selectedTicket) {
        socket.emit('stop_typing', { ticketId: selectedTicket.id, userId: user.id });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const data = new FormData();
      data.append('message', newReplyMessage);
      replyFiles.forEach(file => {
        data.append('attachments', file);
      });

      const res = await axios.post(`/api/tickets/${selectedTicket.id}/reply`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setNewReplyMessage('');
      setReplyFiles([]);
      setSelectedTicket(prev => {
        const alreadyExists = prev.Replies?.some(r => r.id === res.data.id);
        if (alreadyExists) return prev;
        return {
          ...prev,
          Replies: [...(prev.Replies || []), res.data]
        };
      });
      toast.success('تم إرسال الرد بنجاح');
    } catch (error) {
      toast.error('فشل إرسال الرد');
    } finally {
      setSubmittingReply(false);
    }
  };

  const statusMap = {
    'OPEN': { label: 'جديد', color: 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 border-red-200' },
    'IN_PROGRESS': { label: 'جاري العمل', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400 border-yellow-200' },
    'RESOLVED': { label: 'تم الحل', color: 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400 border-green-200' },
    'CLOSED': { label: 'مغلق', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400 border-gray-200' }
  };

  const categoryMap = {
    'HARDWARE': 'أجهزة',
    'PRINTERS': 'طابعات',
    'INTERNET': 'إنترنت',
    'NETWORK': 'شبكة',
    'SOFTWARE': 'برامج',
    'EMAIL': 'إيميل',
    'BILLING': 'فواتير',
    'OTHER': 'أخرى',
    'AS': 'اختصارات'
  };

  const depts = ['الموارد البشرية', 'المالية', 'التشغيل', 'الإدارة', 'المبيعات', 'التسويق', 'تقنية المعلومات'];

  // Check if anyone is typing
  const activelyTypingList = Object.values(typingUsers).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700/60 pb-5">
        <div>
          <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            إدارة طلبات الدعم الفني
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{liveDate || 'لوحة التحكم والمتابعة المباشرة لفريق IT'}</p>
        </div>
        {user?.role === 'EMPLOYEE' && (
          <Link to="/dashboard/tickets/new" className="btn-primary flex items-center gap-2 w-fit shadow-md">
            <Plus size={20} />
            إنشاء طلب جديد
          </Link>
        )}
      </div>

      {/* 4 Dynamic Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card border-r-4 border-blue-500 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-400">إجمالي الطلبات</p>
          <h3 className="text-3xl font-bold mt-2 dark:text-white">{stats.total}</h3>
          <span className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"> الكل</span>
        </div>
        <div className="card border-r-4 border-red-500 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-400">طلبات جديدة</p>
          <h3 className="text-3xl font-bold mt-2 dark:text-white text-red-500">{stats.open}</h3>
          <span className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"> تحتاج متابعة</span>
        </div>
        <div className="card border-r-4 border-yellow-500 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-400">جاري العمل</p>
          <h3 className="text-3xl font-bold mt-2 dark:text-white text-yellow-500">{stats.progress}</h3>
          <span className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"> قيد التنفيذ</span>
        </div>
        <div className="card border-r-4 border-green-500 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-400">تم الحل</p>
          <h3 className="text-3xl font-bold mt-2 dark:text-white text-green-500">{stats.solved}</h3>
          <span className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"> منجز</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card flex flex-wrap gap-4 items-center p-4">
        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map(st => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {st === 'ALL' ? 'الكل' : st === 'OPEN' ? 'جديد' : st === 'IN_PROGRESS' ? 'جاري العمل' : 'تم الحل / مغلق'}
            </button>
          ))}
        </div>

        {/* Department Filters (Admin/IT only) */}
        {user?.role !== 'EMPLOYEE' && (
          <select
            className="input-field text-xs py-1.5 px-3 w-40"
            value={deptFilter}
            onChange={e => { setDeptFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">كل الأقسام</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {/* Category Filter */}
        <select
          className="input-field text-xs py-1.5 px-3 w-40"
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="">كل التصنيفات</option>
          {Object.entries(categoryMap).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Search Input */}
        <div className="relative mr-auto">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="اكتب رقم الطلب فقط بدون #"
            className="input-field pr-9 py-1.5 text-xs w-64"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Refresh button */}
        <button 
          onClick={fetchTickets} 
          className="p-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-500"
          title="تحديث قائمة الطلبات"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tickets List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <RefreshCw size={40} className="animate-spin mx-auto mb-4" />
            <p className="font-semibold text-sm">جاري تحميل طلبات الدعم الفني...</p>
          </div>
        ) : currentTickets.length === 0 ? (
          <div className="text-center py-20 text-gray-400 space-y-3">
            <HelpCircle size={48} className="mx-auto opacity-30" />
            <p className="text-lg font-bold">لا توجد طلبات دعم متطابقة حالياً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/40 text-gray-400 font-bold text-xs border-b border-gray-100 dark:border-gray-800">
                  <th className="p-4">رقم التذكرة</th>
                  <th className="p-4">عنوان المشكلة</th>
                  <th className="p-4">الموظف</th>
                  <th className="p-4">القسم</th>
                  <th className="p-4">التصنيف</th>
                  <th className="p-4">حالة الطلب</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-semibold">
                {currentTickets.map(ticket => (
                  <motion.tr 
                    key={ticket.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors dark:text-gray-200"
                  >
                    <td className="p-4 font-mono text-[11px] text-gray-400">#{ticket.id.substring(0, 8)}</td>
                    <td className="p-4 max-w-xs truncate font-bold text-gray-950 dark:text-white">{ticket.title}</td>
                    <td className="p-4">{ticket.Creator?.name}</td>
                    <td className="p-4">
                      <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-[10px] text-gray-600 dark:text-gray-400">
                        {ticket.Creator?.department || 'عام'}
                      </span>
                    </td>
                    <td className="p-4">{categoryMap[ticket.category] || ticket.category}</td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        statusMap[ticket.status]?.color || ''
                      }`}>
                        {statusMap[ticket.status]?.label || ticket.status}
                      </span>
                    </td>
                    <td className="p-4 text-[10px] text-gray-400 font-mono">
                      {new Date(ticket.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {ticket.status === 'CLOSED' && user?.role === 'EMPLOYEE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg font-bold border border-gray-200 dark:border-gray-700 cursor-not-allowed">
                            مغلق 
                          </span>
                        ) : (
                          <button
                            onClick={() => fetchTicketDetails(ticket.id)}
                            className="btn-secondary px-3 py-1.5 text-xs font-bold hover:bg-primary-50 dark:hover:bg-primary-950/20 hover:text-primary-600 transition-all"
                          >
                            عرض
                          </button>
                        )}
                        {/* Direct delete from list — privileged role OR TICKET_DELETE permission */}
                        {canDeleteTickets && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const shortId = ticket.id.substring(0, 8);
                              if (!window.confirm(`نقل التذكرة #${shortId} لسلة المحذوفات؟`)) return;
                              try {
                                await axios.post(`/api/tickets/${ticket.id}/delete`);
                                toast.success('تم نقل التذكرة لسلة المحذوفات 🗑');
                                setTickets(prev => {
                                  const list = prev.filter(t => t.id !== ticket.id);
                                  calculateStats(list);
                                  return list;
                                });
                              } catch (err) {
                                toast.error(err?.response?.data?.message || 'فشل الحذف');
                              }
                            }}
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="نقل لسلة المحذوفات"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Row (Item 4 - Arrow based pagination) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700/50 mt-6 p-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              الصفحة {currentPage} من {totalPages}
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

      {/* Ticket Details & Replies Modal - Mathematical Centering in Viewport (Item 5) */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedTicket(null); setIsFullScreen(false); }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />

            {/* Centered Modal Container (Item 5) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-40%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-40%' }}
              transition={{ duration: 0.2 }}
              className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 transition-all duration-300 ${isFullScreen ? 'w-screen h-screen rounded-none border-none' : 'w-[92vw] md:w-[75vw] max-w-4xl h-[85vh]'}`}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-primary-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base">تفاصيل طلب الدعم الفني</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">
                    #{selectedTicket.id.substring(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Delete ticket — privileged role OR TICKET_DELETE */}
                  {canDeleteTickets && (
                    <button
                      type="button"
                      onClick={handleDeleteTicket}
                      disabled={modalLoading}
                      className="p-1.5 hover:bg-red-500/30 bg-red-500/20 rounded transition-colors text-white disabled:opacity-50"
                      title="حذف التذكرة نهائياً"
                    >
                      <X size={18} className="hidden" />
                      🗑️
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors text-white"
                    title={isFullScreen ? "تصغير الشاشة" : "ملء الشاشة"}
                  >
                    {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedTicket(null); setIsFullScreen(false); }}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              {modalLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <RefreshCw size={40} className="animate-spin mb-4" />
                  <p className="text-sm font-semibold">جاري تحميل المحادثات والمرفقات...</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                  
                  {/* Top Meta Details Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400">الموظف صاحب الطلب</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{selectedTicket.Creator?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedTicket.Creator?.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400">تصنيف المشكلة</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 bg-white dark:bg-gray-800 border rounded text-xs font-bold text-gray-800 dark:text-gray-300">
                          {categoryMap[selectedTicket.category] || selectedTicket.category}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400">إجراءات الـ IT والتعيين</p>
                      {/* Tech Agent assigned */}
                      {selectedTicket.Assignee ? (
                        <div className="text-xs font-bold text-primary-600 flex items-center gap-1 mt-0.5">
                          👤 معين للفني: {selectedTicket.Assignee.name}
                        </div>
                      ) : (
                        // Privileged roles OR TICKET_CLAIM permission can claim
                        canClaimTickets && (
                          <button
                            onClick={handleAssignToMe}
                            className="btn-primary py-1 px-3 text-[10px] font-bold flex items-center gap-1 shadow-sm mt-0.5"
                          >
                             استلام الطلب وتعيينه لي
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Ticket Description Box */}
                  <div className="space-y-4 border-b border-gray-100 dark:border-gray-700/60 pb-6">
                    {selectedTicket.category === 'BILLING' ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            📊 جدول تفاصيل الفواتير (نظام إكسل)
                          </h3>
                          <button
                            type="button"
                            onClick={() => exportBillingToExcel(selectedTicket)}
                            className="btn-primary py-1 px-3 text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 border-none shrink-0"
                            title="تحميل كملف إكسل"
                          >
                            📥 تحميل الطلب كـ Excel
                          </button>
                        </div>

                        {/* Excel Spreadsheet Table */}
                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-right">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                              <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[20%] text-center">المبلغ (ريال)</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">نوع الفاتورة</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[40%]">التفاصيل</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%] text-center">الحالة</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {(() => {
                                let rows = [];
                                try {
                                  const raw = selectedTicket.billingItems;
                                  if (Array.isArray(raw)) {
                                    rows = raw;
                                  } else if (typeof raw === 'string' && raw.trim()) {
                                    rows = JSON.parse(raw);
                                  } else if (raw && typeof raw === 'object') {
                                    rows = [raw];
                                  }
                                  if (!Array.isArray(rows)) rows = [];
                                } catch (e) {
                                  console.error('billingItems parse error', e);
                                  rows = [];
                                }
                                if (rows.length === 0) {
                                  rows = [{
                                    amount: selectedTicket.description?.match(/\d+/)?.[0] || '0',
                                    type: selectedTicket.title || 'فاتورة',
                                    details: selectedTicket.description || 'لا توجد تفاصيل'
                                  }];
                                }
                                return (
                                  <>
                                    {rows.map((row, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-gray-900 dark:text-gray-100 font-mono text-center border-l border-gray-100 dark:border-gray-700">
                                          {parseFloat(row.amount || 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-gray-950 dark:text-gray-50 border-l border-gray-100 dark:border-gray-700 font-semibold">
                                          {row.type}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-450 border-l border-gray-100 dark:border-gray-700">
                                          {row.details}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-center">
                                          {selectedTicket.billingStatus === 'APPROVED' ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">مقبول</span>
                                          ) : selectedTicket.billingStatus === 'REJECTED' ? (
                                            <span className="text-red-600 dark:text-red-400 font-bold">مرفوض</span>
                                          ) : (
                                            <span className="text-yellow-600 dark:text-yellow-400 font-bold">معلق</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    {/* Sum Row */}
                                    <tr className="bg-primary-50/20 dark:bg-primary-950/10 font-bold">
                                      <td className="px-4 py-3 text-sm text-primary-600 dark:text-primary-400 text-center font-mono border-l border-gray-100 dark:border-gray-700">
                                        {rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toFixed(2)} ر.س
                                      </td>
                                      <td colSpan="3" className="px-4 py-3 text-xs text-gray-550 dark:text-gray-400 text-left font-bold">
                                        المجموع الكلي للفاتورة:
                                      </td>
                                    </tr>
                                  </>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>

                        {/* Approve / Reject — admin role OR INVOICE_APPROVE permission */}
                        {canApproveInvoices && selectedTicket.billingStatus === 'PENDING' && (
                          <div className="flex items-center gap-3 bg-gray-55 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex-1">
                              👉 اتخاذ إجراء إداري بشأن الفاتورة:
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateBillingStatus('APPROVED')}
                              className="bg-emerald-65 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-all shadow-sm"
                            >
                              ✓ موافقة وقبول
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBillingStatus('REJECTED')}
                              className="bg-red-65 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-all shadow-sm"
                            >
                              ✗ رفض الفاتورة
                            </button>
                          </div>
                        )}

                        {/* Already processed feedback block */}
                        {selectedTicket.billingStatus && selectedTicket.billingStatus !== 'PENDING' && (
                          <div className={`p-3 rounded-lg text-center font-bold text-xs mt-2 border ${selectedTicket.billingStatus === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-25' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-25'}`}>
                            {selectedTicket.billingStatus === 'APPROVED' ? '✅ تم قبول هذه الفاتورة رسمياً من قبل الإدارة' : '❌ تم رفض هذه الفاتورة من قبل الإدارة'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {selectedTicket.title}
                        </h3>
                        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-primary-50/20 dark:bg-primary-950/5 border border-primary-100/50 dark:border-primary-950/20 rounded-lg p-4 font-medium">
                          {selectedTicket.description}
                        </div>
                      </>
                    )}

                    {/* Original Attachments (Item 8) */}
                    {selectedTicket.Attachments && selectedTicket.Attachments.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] font-bold text-gray-400">📎 المرفقات الأصلية المرفقة مع الطلب:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTicket.Attachments.map(att => {
                            const isImg = att.fileType && att.fileType.startsWith('image/');
                            const fileLink = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${att.fileUrl.replace(/\\/g, '/')}`;
                            return (
                              <div key={att.id} className="inline-block">
                                {isImg ? (
                                  <div className="flex flex-col items-center">
                                    <img
                                      src={fileLink}
                                      alt={att.fileName}
                                      className="rounded-lg max-h-32 border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-95 transition-all mt-1"
                                      onClick={() => setLightboxImage(fileLink)}
                                    />
                                    <span className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[120px]">{att.fileName}</span>
                                  </div>
                                ) : (
                                  <a
                                    href={fileLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                  >
                                    <Paperclip size={12} className="text-gray-400" />
                                    <span className="max-w-40 truncate">{att.fileName}</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Assignment Actions (Visible only to IT Support / Admin) */}
                  {user?.role !== 'EMPLOYEE' && (
                    <div className="bg-gray-50 dark:bg-gray-900/10 p-4 rounded-lg border border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">التحكم بحالة الطلب ومسؤول المتابعة</p>
                        <p className="text-[10px] text-gray-400">يمكنك تعديل حالة التذكرة لضمان متابعتها من الفريق بشكل صحيح.</p>
                      </div>

                      <div className="flex gap-2">
                        <select
                          className="input-field text-xs py-1 px-3 w-40"
                          value={selectedTicket.status}
                          onChange={e => handleUpdateStatus(e.target.value)}
                        >
                          <option value="OPEN">جديد (Open)</option>
                          <option value="IN_PROGRESS">جاري العمل (In Progress)</option>
                          <option value="RESOLVED">تم الحل (Resolved)</option>
                          <option value="CLOSED">مغلق (Closed)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Replies Chat / Timeline */}
                  <div className="flex-1 flex flex-col space-y-4">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700/50 pb-2">
                       المحادثات وردود الدعم الفني ({selectedTicket.Replies?.length || 0})
                    </h4>

                    <div className="flex-1 min-h-[350px] md:min-h-[400px] overflow-y-auto pr-2 flex flex-col space-y-4 p-4 rounded-xl border border-gray-150 dark:border-gray-750 bg-gray-50/20 dark:bg-gray-900/10 mb-2">
                      {selectedTicket.Replies && selectedTicket.Replies.length > 0 ? (
                        selectedTicket.Replies.map(reply => {
                          const isOwn = reply.userId === user.id;
                          return (
                            <div 
                              key={reply.id} 
                              className={`flex items-start gap-3 max-w-[80%] ${isOwn ? 'self-start flex-row' : 'self-end flex-row-reverse text-right'}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-[10px] shrink-0 border border-primary-200 dark:border-primary-850">
                                {reply.User?.name?.substring(0, 2) || 'IT'}
                              </div>
                              <div className={`flex flex-col ${isOwn ? 'items-start text-left' : 'items-end text-right'}`}>
                                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold mb-0.5">
                                  <span>{reply.User?.name}</span>
                                  <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-750 text-[8px] rounded text-gray-500 dark:text-gray-300">
                                    {reply.User?.role === 'IT_SUPPORT' ? 'دعم فني' : reply.User?.role === 'ADMIN' ? 'مدير' : 'موظف'}
                                  </span>
                                </div>
                                
                                <div className={`p-3 px-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
                                  isOwn 
                                    ? 'bg-primary-600 text-white rounded-tl-none' 
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 border border-emerald-200/60 dark:border-emerald-900/30 rounded-tr-none'
                                }`} style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
                                  {reply.message}
                                </div>

                                {/* Reply attachments rendering (Item 7) */}
                                {reply.Attachments && reply.Attachments.length > 0 && (
                                  <div className="mt-2 space-y-1.5 flex flex-col items-end w-full">
                                    {reply.Attachments.map(att => {
                                      const isImg = att.fileType && att.fileType.startsWith('image/');
                                      const fileLink = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${att.fileUrl.replace(/\\/g, '/')}`;
                                      return (
                                        <div key={att.id} className="max-w-xs">
                                          {isImg ? (
                                            <img
                                              src={fileLink}
                                              alt={att.fileName}
                                              className="rounded-lg max-h-40 border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-all mt-1"
                                              onClick={() => setLightboxImage(fileLink)}
                                            />
                                          ) : (
                                            <a
                                              href={fileLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl hover:text-primary-600 dark:hover:text-primary-400 transition-all text-xs"
                                            >
                                              <Paperclip size={14} className="text-gray-400" />
                                              <span className="truncate max-w-40">{att.fileName}</span>
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                <span className="text-[8px] text-gray-400 mt-1 font-semibold">
                                  {new Date(reply.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 text-gray-400 text-xs my-auto">
                          لا توجد ردود على هذا الطلب بعد.
                        </div>
                      )}

                      {/* Real-time Typing indicator label (Item 6) */}
                      {activelyTypingList.length > 0 && (
                        <div className="self-end flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-100/50 dark:bg-gray-800/30 p-2 px-3 rounded-xl border border-gray-200 dark:border-gray-750/30 animate-pulse mt-2 ml-10">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          <span>{activelyTypingList.join(' و')} يكتب الآن...</span>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>
                  </div>

                  {/* Add Reply Form with Attachment Selector (Item 6 & 7) */}
                  <form onSubmit={handleAddReply} className="border-t border-gray-100 dark:border-gray-700/60 pt-4 mt-auto">
                    {/* Selected files preview block */}
                    {replyFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-150 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-850">
                        {replyFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                            <span className="truncate max-w-40 dark:text-gray-300">{file.name}</span>
                            <button type="button" onClick={() => removeReplyFile(idx)} className="text-red-500 hover:bg-red-50 p-0.5 rounded transition-all">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Disable warning banner */}
                    {(() => {
                      const isClaimedByMe = selectedTicket?.assignedTo === user?.id;
                      const isEmployeeWaiting =
                        user?.role === 'EMPLOYEE' &&
                        selectedTicket?.status === 'OPEN' &&
                        selectedTicket?.category !== 'BILLING';
                      const isClosed = selectedTicket?.status === 'CLOSED';
                      const isBillingRejected =
                        selectedTicket?.category === 'BILLING' &&
                        selectedTicket?.billingStatus === 'REJECTED';
                      const canReply =
                        !isClosed &&
                        !isBillingRejected &&
                        (
                          (user?.role === 'EMPLOYEE' && !isEmployeeWaiting) ||
                          isClaimedByMe ||
                          (['ADMIN', 'SUPER_ADMIN'].includes(user?.role) && selectedTicket?.category === 'BILLING')
                        );

                      let lockMsg = '';
                      if (isClosed) lockMsg = ' هذه التذكرة مغلقة — لا يمكن إضافة ردود.';
                      else if (isBillingRejected) lockMsg = ' تم رفض هذه الفاتورة وأُغلقت التذكرة — لا يمكن إضافة ردود.';
                      else if (isEmployeeWaiting) lockMsg = ' في انتظار استلام الدعم الفني للطلب — لن تتمكن من الرد حتى تبدأ المعالجة.';
                      else lockMsg = ' يرجى استلام الطلب وتعيينه لنفسك أولاً لتتمكن من الرد والتحدث مع الموظف.';

                      return (
                        <>
                          {!canReply && (
                            <div className={`p-3 border rounded-xl text-center text-xs font-bold mb-3 flex items-center justify-center gap-2 ${
                              isClosed || isBillingRejected
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400'
                                : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                            }`}>
                              {lockMsg}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            {/* Hidden File Input */}
                            <input
                              type="file"
                              multiple
                              ref={fileInputRef}
                              className="hidden"
                              onChange={handleReplyFilesChange}
                              disabled={!canReply}
                              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                            />

                            {/* File upload button */}
                            <button
                              type="button"
                              disabled={!canReply}
                              onClick={() => fileInputRef.current.click()}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-primary-600 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="أرفق صور أو ملفات"
                            >
                              <Paperclip size={18} />
                            </button>

                            <input
                              type="text"
                              disabled={!canReply || submittingReply}
                              placeholder={canReply ? "اكتب ردك ومتابعتك هنا..." : "يجب استلام الطلب أولاً للتمكن من الرد..."}
                              className="input-field text-xs flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                              value={newReplyMessage}
                              onChange={handleReplyChange}
                            />
                            <button 
                              type="submit" 
                              disabled={!canReply || submittingReply || (!newReplyMessage.trim() && replyFiles.length === 0)}
                              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            >
                              <Send size={14} />
                              إرسال الرد
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </form>

                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] cursor-zoom-out"
            />
            {/* Lightbox Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-4 sm:inset-10 z-[101] flex flex-col items-center justify-center pointer-events-none"
            >
              <div className="relative max-w-full max-h-full flex items-center justify-center pointer-events-auto bg-gray-900/40 p-2 rounded-2xl border border-white/10 shadow-2xl">
                <img
                  src={lightboxImage}
                  alt="Full view"
                  className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain shadow-lg"
                />
                {/* Close Button */}
                <button
                  onClick={() => setLightboxImage(null)}
                  className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-all cursor-pointer"
                  title="إغلاق المعاينة"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tickets;
