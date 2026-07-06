import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, X, AlertCircle, Plus, Trash2 } from 'lucide-react';

const CreateTicket = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: location.state?.category || 'HARDWARE',
    priority: 'MEDIUM',
    softwareName: ''
  });
  const [billingRows, setBillingRows] = useState([{ amount: '', type: '', details: '' }]);
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: 'HARDWARE', label: 'أجهزة' },
    { value: 'PRINTERS', label: 'طابعات' },
    { value: 'INTERNET', label: 'إنترنت' },
    { value: 'NETWORK', label: 'شبكة' },
    { value: 'SOFTWARE', label: 'برامج' },
    { value: 'EMAIL', label: 'إيميل' },
    { value: 'BILLING', label: 'فواتير' },
    { value: 'OTHER', label: 'أخرى' },
    { value: 'AS', label: 'اختصارات' }
  ];

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB - matches server limit

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 10) {
      toast.error('الحد الأقصى 10 ملفات فقط');
      return;
    }
    const oversized = selected.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(`الملف "${oversized.name}" يتجاوز الحد الأقصى 5 ميجابايت`);
      return;
    }
    setFiles(selected);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addBillingRow = () => {
    setBillingRows([...billingRows, { amount: '', type: '', details: '' }]);
  };

  const removeBillingRow = (index) => {
    if (billingRows.length === 1) return;
    setBillingRows(billingRows.filter((_, i) => i !== index));
  };

  const updateBillingRow = (index, field, value) => {
    const updated = [...billingRows];
    updated[index][field] = value;
    setBillingRows(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalTitle = formData.title;
    let finalDescription = formData.description;

    if (formData.category === 'BILLING') {
      const hasEmpty = billingRows.some(row => !row.amount || !row.type || !row.details);
      if (hasEmpty) {
        toast.error('الرجاء ملء جميع حقول جدول الفواتير (المبلغ، النوع، التفاصيل)');
        return;
      }

      if (files.length === 0) {
        toast.error('يجب إرفاق صورة الفاتورة أو ملف لتتمكن من إرسال طلب الفواتير');
        return;
      }

      const totalAmount = billingRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      finalTitle = `طلب فواتير بقيمة ${totalAmount} ريال`;
      finalDescription = billingRows.map(r => `المبلغ: ${r.amount} | النوع: ${r.type} | التفاصيل: ${r.details}`).join('\n');
    }

    setIsSubmitting(true);

    const data = new FormData();
    data.append('title', finalTitle);
    data.append('description', finalDescription);
    data.append('category', formData.category);
    data.append('priority', formData.priority);
    if (formData.category === 'SOFTWARE' && formData.softwareName) {
      data.append('softwareName', formData.softwareName);
    }
    if (formData.category === 'BILLING') {
      data.append('billingItems', JSON.stringify(billingRows));
    }
    
    files.forEach(file => {
      data.append('attachments', file);
    });

    try {
      await axios.post('/api/tickets', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('تم إنشاء الطلب بنجاح');
      navigate('/dashboard/tickets');
    } catch (error) {
      toast.error(error.response?.data?.message || 'خطأ في إنشاء الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold dark:text-white">إنشاء طلب دعم فني جديد</h2>
        <p className="text-gray-500 dark:text-gray-400">يرجى تعبئة التفاصيل أدناه لمساعدتنا في حل مشكلتك بسرعة.</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {formData.category !== 'BILLING' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-300">عنوان الطلب</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  placeholder="مثال: الطابعة لا تعمل"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
            ) : null}

            <div className={`space-y-2 ${formData.category === 'BILLING' ? 'col-span-2' : 'col-span-1'}`}>
              <label className="text-sm font-medium dark:text-gray-300">التصنيف</label>
              <select
                className="input-field"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <AnimatePresence>
            {formData.category === 'SOFTWARE' && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="space-y-2 overflow-hidden"
              >
                <label className="text-sm font-medium text-primary-600 dark:text-primary-400">اسم البرنامج <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  className="input-field border-primary-200 focus:ring-primary-500 bg-primary-50/30"
                  placeholder="أدخل اسم البرنامج الذي تواجه مشكلة فيه"
                  value={formData.softwareName}
                  onChange={e => setFormData({...formData, softwareName: e.target.value})}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {formData.category === 'BILLING' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm">
                  <strong>تنبيه:</strong> لقد قمت باختيار تصنيف "فواتير". سيتم تحويل هذا الطلب تلقائياً إلى قسم الإدارة ولن يظهر لفريق الدعم الفني.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Billing Excel-like Table */}
          {formData.category === 'BILLING' && (
            <div className="space-y-4">
              <label className="text-sm font-semibold dark:text-gray-300 block">جدول تفاصيل الفواتير (نظام إكسل) <span className="text-red-500">*</span></label>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-right">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[20%] text-center">المبلغ (ريال)</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">نوع الفاتورة</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[40%]">التفاصيل</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%] text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {billingRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-3 py-2">
                          <input
                            required
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="input-field py-1.5 text-xs text-center border-gray-300 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700"
                            value={row.amount}
                            onChange={(e) => updateBillingRow(idx, 'amount', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            required
                            type="text"
                            placeholder="مثال: فاتورة كهرباء"
                            className="input-field py-1.5 text-xs border-gray-300 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700"
                            value={row.type}
                            onChange={(e) => updateBillingRow(idx, 'type', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            required
                            type="text"
                            placeholder="تفاصيل إضافية..."
                            className="input-field py-1.5 text-xs border-gray-300 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700"
                            value={row.details}
                            onChange={(e) => updateBillingRow(idx, 'details', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            disabled={billingRows.length === 1}
                            onClick={() => removeBillingRow(idx)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded-lg disabled:opacity-40 transition-colors"
                            title="حذف السطر"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Sum Row */}
                    <tr className="bg-primary-50/20 dark:bg-primary-950/10 font-bold">
                      <td className="px-4 py-3 text-sm text-primary-600 dark:text-primary-400 text-center">
                        {billingRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toFixed(2)} ر.س
                      </td>
                      <td colSpan="2" className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-left">
                        المجموع الإجمالي:
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={addBillingRow}
                          className="btn-primary py-1 px-2.5 text-[11px] font-bold flex items-center gap-1 mx-auto"
                        >
                          <Plus size={12} />
                          إضافة سطر
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {formData.category !== 'BILLING' && (
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">الوصف بالتفصيل</label>
              <textarea
                required
                rows="4"
                className="input-field resize-none"
                placeholder="اشرح المشكلة بالتفصيل..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              ></textarea>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-gray-300">
              {formData.category === 'BILLING' ? 'مرفقات وصور الفاتورة (إجباري) *' : 'المرفقات (اختياري)'}
            </label>
            <div className={`border-2 border-dashed rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${formData.category === 'BILLING' ? 'border-primary-300 dark:border-primary-800 bg-primary-50/5' : 'border-gray-300 dark:border-gray-700'}`}>
              <input
                type="file"
                multiple
                id="file-upload"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                  <Paperclip size={24} />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">انقر هنا لرفع الملفات، أو اسحب الملفات وأفلتها هنا</span>
                <span className="text-xs text-gray-400">يدعم: صور، PDF، Word، Excel (الحد الأقصى 10 ملفات - 5 ميجابايت لكل ملف)</span>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span className="text-sm truncate max-w-[80%] dark:text-gray-300">{file.name}</span>
                    <button type="button" onClick={() => removeFile(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex items-center gap-2"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Send size={18} />
                  إرسال الطلب
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;
