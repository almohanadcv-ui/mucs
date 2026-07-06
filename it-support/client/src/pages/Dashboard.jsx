import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { motion } from 'framer-motion';
import { Ticket, Clock, CheckCircle, Users, BarChart3, PieChart, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();

  if (user?.role === 'EMPLOYEE') {
    return <Navigate to="/dashboard/tickets" replace />;
  }

  const [stats, setStats] = useState(null);
  const [ticketsList, setTicketsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Analytics distributions
  const [categoryDistribution, setCategoryDistribution] = useState([]);
  const [deptDistribution, setDeptDistribution] = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, ticketsRes] = await Promise.all([
        axios.get('/api/stats'),
        axios.get('/api/tickets'),
      ]);
      setStats(statsRes.data || {});
      const list = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];
      setTicketsList(list);
      calculateDistributions(list);
    } catch (error) {
      setTicketsList([]);
      setCategoryDistribution([]);
      setDeptDistribution([]);
      if (error?.response?.status !== 401) {
        console.error(error);
        toast.error('خطأ في تحميل بيانات لوحة التحكم');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateDistributions = (tickets) => {
    const arr = Array.isArray(tickets) ? tickets : [];
    const total = arr.length || 1;
    tickets = arr;

    // Categories
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

    const catCounts = {};
    Object.keys(categoryMap).forEach(k => { catCounts[k] = 0; });
    
    tickets.forEach(t => {
      if (catCounts[t.category] !== undefined) {
        catCounts[t.category]++;
      } else {
        catCounts['OTHER'] = (catCounts['OTHER'] || 0) + 1;
      }
    });

    const catArray = Object.entries(catCounts).map(([key, count]) => ({
      key,
      label: categoryMap[key] || key,
      count,
      percentage: Math.round((count / total) * 100)
    })).sort((a, b) => b.count - a.count);

    setCategoryDistribution(catArray);

    // Departments
    const deptCounts = {};
    tickets.forEach(t => {
      const dept = t.Creator?.department || 'بدون قسم';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    const deptArray = Object.entries(deptCounts).map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 100)
    })).sort((a, b) => b.count - a.count);

    setDeptDistribution(deptArray);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Sockets listening
  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        fetchDashboardData();
      };
      socket.on('new_ticket', handleUpdate);
      socket.on('ticket_updated', handleUpdate);
      socket.on('new_user_registration', handleUpdate);

      return () => {
        socket.off('new_ticket', handleUpdate);
        socket.off('ticket_updated', handleUpdate);
        socket.off('new_user_registration', handleUpdate);
      };
    }
  }, [socket]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card h-32 animate-pulse bg-gray-150 dark:bg-gray-800/40"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-96 animate-pulse bg-gray-150 dark:bg-gray-800/40"></div>
          <div className="card h-96 animate-pulse bg-gray-150 dark:bg-gray-800/40"></div>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'إجمالي الطلبات', value: stats?.totalTickets || 0, icon: Ticket, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', sub: ' الكل' },
    { title: 'الطلبات المفتوحة', value: stats?.openTickets || 0, icon: Clock, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', sub: ' تحتاج متابعة' },
    { title: 'تم الحل', value: (stats?.resolvedTickets || 0) + (stats?.closedTickets || 0), icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', sub: ' منجز' },
  ];

  if (['ADMIN', 'SUPER_ADMIN', 'IT_SUPPORT'].includes(user?.role)) {
    statCards.push({ title: 'الموظفين المسجلين', value: stats?.totalEmployees || 0, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', sub: ' حسابات الموظفين' });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">مرحباً بعودتك، {user?.name} </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">نظرة عامة على نشاط لوحة التحكم والتحليلات اليوم</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="card flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <p className="text-xs font-semibold text-gray-400">{stat.title}</p>
                <h3 className="text-3xl font-bold mt-2 dark:text-white">{stat.value}</h3>
                <span className="text-[10px] mt-2 inline-block font-bold">{stat.sub}</span>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Analytics Charts Panels (deptChart & catChart) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card space-y-6"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
            <BarChart3 className="text-primary-500" size={20} />
            <h3 className="font-bold dark:text-white text-base">توزيع الطلبات حسب نوع المشكلة</h3>
          </div>

          <div className="space-y-4">
            {categoryDistribution.map((cat, idx) => (
              <div key={cat.key} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-700 dark:text-gray-300">{cat.label}</span>
                  <span className="text-gray-400">
                    {cat.count} طلب ({cat.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.percentage}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.05 }}
                    className="bg-primary-600 h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Department distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card space-y-6"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
            <PieChart className="text-primary-500" size={20} />
            <h3 className="font-bold dark:text-white text-base">توزيع الطلبات حسب القسم والمصدر</h3>
          </div>

          <div className="space-y-4">
            {deptDistribution.length > 0 ? (
              deptDistribution.map((dept, idx) => (
                <div key={dept.label} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-700 dark:text-gray-300">{dept.label}</span>
                    <span className="text-gray-400">
                      {dept.count} طلب ({dept.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dept.percentage}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.05 }}
                      className="bg-purple-600 h-full rounded-full"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                لا توجد بيانات أقسام مسجلة حالياً
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Dashboard;
