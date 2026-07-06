import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Portal = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate Loading Bar
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsLoading(false), 500); // Wait half a second before fading out
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const roles = [
    { name: 'الموظفين', path: '/login/employee' },
    { name: 'الإدارة', path: '/login/admin' },
    { name: 'الدعم الفني', path: '/login/it' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const childVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 150,
      },
    },
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center z-10 w-full max-w-md px-6 bg-white/70 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/50"
          >
            <div className="flex items-center gap-2 mb-8">
              <img src="/logo.png" alt="MAB Logo" className="h-16 object-contain" />
            </div>
            
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[#0A66FF]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="portal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg z-10 flex flex-col items-center px-4"
          >
            <motion.h2 
              className="text-3xl text-[#4B5E8A] font-bold mb-12 text-center tracking-wide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 120, delay: 0.15 }}
            >
              مرحباً بك في بوابة النظام
            </motion.h2>

            <div className="w-full space-y-4 px-6">
              {roles.map((role, idx) => (
                <motion.button
                  key={role.name}
                  whileHover={{ scale: 1.03, backgroundColor: '#FFFFFF', boxShadow: '0 10px 15px -3px rgba(10, 102, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.15 }}
                  onClick={() => navigate(role.path)}
                  className="w-full bg-white/95 border border-[#E2E8F0] hover:border-[#0A66FF] text-[#4B5E8A] hover:text-[#0A66FF] py-5 rounded-2xl flex items-center justify-between px-8 shadow-sm transition-all duration-300"
                >
                  <span className="text-base font-black tracking-tighter text-[#0A66FF]">MAB</span>
                  <span className="text-base font-bold">{role.name}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Portal;
