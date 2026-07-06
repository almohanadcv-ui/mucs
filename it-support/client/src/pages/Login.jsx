import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';

const Login = () => {
  const { role } = useParams(); // 'employee', 'it', 'admin'
  const navigate = useNavigate();
  const { login, logout, user, loginWithUserData } = useAuth();

  useEffect(() => {
    // اجباري جدا طلب تسجيل دخول حتى لو مسجل مسبقا
    if (user) {
      logout();
    }
  }, []);

  const [activeTab, setActiveTab] = useState('login'); // login, register, forgot
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');

  // Status Check State
  const [statusEmail, setStatusEmail] = useState('');
  
  // Password Change State
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [tempCode, setTempCode] = useState('');

  // Force-login modal (shown when account is already logged in elsewhere)
  const [showForceLogin, setShowForceLogin] = useState(false);

  const roleTitle = role === 'employee' ? 'الموظفين' : role === 'it' ? 'الدعم الفني (IT)' : 'الإدارة';

  const isPasswordStrong = (pass) => {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(pass);
    const hasLowercase = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecialChar = /[@$!%*?&#]/.test(pass);
    return pass.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  };

  const handleLogin = async (e, opts = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsLoading(true);
    try {
      const payload = { email, password, portalRole: role };
      if (opts.forceLogin) payload.forceLogin = true;
      const res = await axios.post('/api/auth/login', payload);

      if (res.data.requirePasswordChange) {
        setRequirePasswordChange(true);
        setTempCode(password);
        toast('يجب تغيير كلمة المرور للمتابعة', { icon: '⚠️' });
      } else {
        loginWithUserData(res.data);
        navigate('/dashboard');
      }
    } catch (error) {
      // Differentiate network/server errors from auth errors so we never show the
      // generic "خطأ في تسجيل الدخول" when there's something more actionable.
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      const code = error?.response?.data?.code;
      if (code === 'ALREADY_LOGGED_IN') {
        // Show modal asking if user wants to force-login (kick the other session)
        setShowForceLogin(true);
      } else if (serverMsg) {
        toast.error(serverMsg);
      } else if (status === 429) {
        toast.error('محاولات كثيرة، يرجى المحاولة بعد 15 دقيقة.');
      } else if (!error.response) {
        toast.error('تعذّر الاتصال بالخادم. تأكد أن السيرفر يعمل ثم حاول مجدداً.');
      } else {
        toast.error(`خطأ غير متوقع (${status})`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!isPasswordStrong(newPassword)) {
      return toast.error('يجب أن تكون كلمة المرور قوية جداً: 8 خانات على الأقل، تحتوي على حرف كبير (A-Z)، حرف صغير (a-z)، رقم (0-9)، ورمز خاص مثل (@$!%*?&)');
    }

    setIsLoading(true);
    try {
      const res = await axios.post('/api/auth/change-password', {
        email, temporaryCode: tempCode, newPassword
      });
      // Automatically login via context with new token manually or just tell user to login again
      toast.success('تم تغيير كلمة المرور بنجاح، جاري الدخول...');
      loginWithUserData(res.data);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل تغيير كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await axios.post('/api/auth/employee-register', {
        name, email, department, location,
      });
      toast.success(res.data.message);
      setActiveTab('login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل إرسال الطلب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    if (!statusEmail) return toast.error('الرجاء إدخال البريد الإلكتروني');

    setIsLoading(true);
    try {
      const res = await axios.post('/api/auth/check-status', { email: statusEmail });
      if (res.data.status === 'ACTIVE') {
        toast.success(res.data.message);
      } else {
        toast(res.data.message, { icon: '⏳' });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'خطأ في التحقق');
    } finally {
      setIsLoading(false);
    }
  };

  const [forgotEmail, setForgotEmail] = useState('');
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return toast.error('الرجاء إدخال البريد الإلكتروني');

    setIsLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: forgotEmail });
      toast.success(res.data.message || 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني.');
      setActiveTab('login');
      setEmail(forgotEmail);
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ، يرجى المحاولة لاحقاً.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4 relative overflow-hidden"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white/95 backdrop-blur-md rounded-[2rem] shadow-2xl border border-white/50 p-8 z-10 relative"
      >
        {/* Back to Portal button */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 flex items-center gap-1 text-xs font-semibold text-[#4B5E8A] hover:text-[#0A66FF] bg-[#F8FAFC] hover:bg-[#EEF2FF] px-3 py-1.5 rounded-lg border border-gray-200 hover:border-[#0A66FF] transition-all"
          title="العودة للصفحة الرئيسية"
        >
          <ArrowRight size={14} />
          الرئيسية
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="MAB Logo" className="h-16 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-[#4B5E8A] mb-2">{roleTitle}</h1>
          <p className="text-sm text-gray-500">
            يرجى تسجيل الدخول للوصول إلى الخدمات. إذا لم يكن لديك حساب، تواصل مع مدير النظام لإنشائه.
          </p>
        </div>

        {requirePasswordChange ? (
          <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleChangePassword} className="space-y-4">
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg text-sm mb-4 border border-yellow-200">
              يرجى تعيين كلمة مرور جديدة لحسابك لتتمكن من الدخول بأمان.
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0A66FF]">البريد الإلكتروني</label>
              <input type="email" disabled value={email} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-100 text-gray-700 text-sm" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0A66FF]">كلمة المرور الجديدة *</label>
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900 placeholder:text-gray-400" placeholder="••••••••" dir="ltr" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-[#0A66FF] hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors mt-2">
              {isLoading ? 'جاري التحديث...' : 'تغيير كلمة المرور والدخول'}
            </button>
          </motion.form>
        ) : (
          <>
            {/* Tabs — "Create Account" tab DISABLED by policy. Only the
                 admin can create accounts via the Users page. */}
            <div className="flex bg-[#F8FAFC] rounded-lg p-1 mb-8">
              <button onClick={() => setActiveTab('login')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'login' ? 'bg-white text-[#0A66FF] shadow-sm' : 'text-gray-500'}`}>تسجيل الدخول</button>
              <button onClick={() => setActiveTab('forgot')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'forgot' ? 'bg-white text-[#0A66FF] shadow-sm' : 'text-gray-500'}`}>نسيت كلمة المرور</button>
            </div>

            <AnimatePresence mode="wait">
              {/* Login Form */}
              {activeTab === 'login' && (
                <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#0A66FF]">البريد الإلكتروني *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900 placeholder:text-gray-400" placeholder="example@mapunited.com" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#0A66FF]">كلمة المرور *</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900 placeholder:text-gray-400" placeholder="••••••••" dir="ltr" />
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full bg-[#0A66FF] hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors mt-2">
                    {isLoading ? 'جاري التحميل...' : 'تسجيل الدخول'}
                  </button>
                </motion.form>
              )}

              {/* Register Form (Employee Only) */}
              {activeTab === 'register' && role === 'employee' && (
                <motion.form key="register" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleRegister} className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs mb-2">
                    طلبك سيصلنا، وسنقوم بتفعيل حسابك في أقرب وقت وإرسال رمز الدخول على بريدك.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#0A66FF]">الاسم الكامل *</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900 placeholder:text-gray-400" placeholder="أدخل اسمك" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#0A66FF]">القسم *</label>
                      <select required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900">
                        <option value="">اختر القسم</option>
                        <option value="HR">الموارد البشرية</option>
                        <option value="Purchasing">المشتريات</option>
                        <option value="Accounting">المحاسبة</option>
                        <option value="Marketing">التسويق</option>
                        <option value="Mechanical">ميكانيكي</option>
                        <option value="Electrical">كهربائي</option>
                        <option value="Electrical">منسق</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#0A66FF]">الموقع *</label>
                    <select required value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900">
                      <option value="">اختر الموقع</option>
                      <option value="القدية">القدية</option>
                      <option value="الدرعية">الدرعية</option>
                      <option value="المقر الرئيسي">المقر الرئيسي</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#0A66FF]">البريد الإلكتروني *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900 placeholder:text-gray-400" placeholder="example@mapunited.com" dir="ltr" />
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full bg-[#0A66FF] hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors mt-2">
                    {isLoading ? 'جاري الإرسال...' : 'إرسال طلب التسجيل →'}
                  </button>
                </motion.form>
              )}

              {/* Forgot Password Form */}
              {activeTab === 'forgot' && (
                <motion.form
                  key="forgot"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleForgotPassword}
                  className="space-y-4"
                >
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs mb-2">
                    أدخل بريدك الإلكتروني وسنرسل لك رمزاً مؤقتاً. استخدم هذا الرمز كـ "كلمة مرور" في تبويب تسجيل الدخول، وسيُطلب منك تعيين كلمة مرور جديدة.
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#0A66FF]">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#0A66FF] focus:ring-1 focus:ring-[#0A66FF] outline-none text-sm bg-white text-gray-900 placeholder:text-gray-400"
                      placeholder="example@mapunited.com"
                      dir="ltr"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#0A66FF] hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors mt-2"
                  >
                    {isLoading ? 'جاري الإرسال...' : 'إرسال رمز الاستعادة'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Check Status Box — hidden: public registration disabled by policy */}
          </>
        )}
      </motion.div>

      {/* Force-login confirmation modal */}
      <AnimatePresence>
        {showForceLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForceLogin(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl"
            >
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🔒</div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  الحساب مسجّل دخول من جهاز آخر
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  لو نسيت تسجيل خروج من جهاز آخر أو الجهاز السابق غير متاح،
                  اضغط <strong>"تسجيل خروج الجهاز الآخر"</strong> لإغلاق
                  تلك الجلسة وفتح جلسة جديدة هنا.
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40 rounded-lg p-3 text-xs text-yellow-800 dark:text-yellow-400 mb-5">
                ⚠️ سيتم تسجيل خروج الجهاز الآخر فوراً.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForceLogin(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForceLogin(false);
                    handleLogin(null, { forceLogin: true });
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors"
                >
                  تسجيل خروج الجهاز الآخر
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
