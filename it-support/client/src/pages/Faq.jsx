import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ArrowLeft, Send, Search, CheckCircle2, ChevronRight } from 'lucide-react';

const Faq = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeFaq, setActiveFaq] = useState(null);

  const categories = [
    { value: 'ALL', label: 'جميع التصنيفات' },
    { value: 'HARDWARE', label: 'أجهزة' },
    { value: 'PRINTERS', label: 'طابعات' },
    { value: 'INTERNET', label: 'إنترنت' },
    { value: 'SOFTWARE', label: 'برامج' },
    { value: 'EMAIL', label: 'إيميل' },
    { value: 'WORD', label: 'اختصارات وورد' },
    { value: 'EXCEL', label: 'اختصارات اكسل' },
    { value: 'PDF', label: 'اختصارات بي دي اف' },
    { value: 'WINDOWS', label: 'اختصارات ويندوز' },
    { value: 'GENERAL', label: 'اختصارات عامة' },
  ];

  const faqs = [
    {
      id: 1,
      category: 'HARDWARE',
      title: 'الشاشة سوداء أو لا تعمل',
      problem: 'عند تشغيل الجهاز، الشاشة تظل سوداء ولا يظهر أي محتوى رغم عمل مروحة الكمبيوتر.',
      steps: [
        'تأكد من أن كابل الطاقة للشاشة موصل بمصدر الكهرباء بشكل سليم وأن زر تشغيل الشاشة مضيء.',
        'تحقق من كابل البيانات المتصل بين الشاشة والجهاز (HDMI أو DisplayPort) وقم بنزعه وإعادة تركيبه بإحكام.',
        'إذا كانت الشاشة مضيئة باللون البرتقالي (وضع الاستعداد)، اضغط على أي زر في لوحة المفاتيح أو حرك الفأرة لتنشيطها.',
        'إذا لم تعمل الشاشة بعد هذه الخطوات، جرب توصيلها بمنفذ آخر في الجهاز أو تواصل معنا فوراً.'
      ]
    },

    {
      id: 2,
      category: 'WORD',
      title: 'اختصارات وورد',
      problem: 'هاذي اهم وافضل الاختصارات في برنامج WORD',
      steps: [
        'Ctrl + B : جعل النص عريض (Bold).',
  'Ctrl + I : جعل النص مائل (Italic).',
  'Ctrl + U : وضع خط أسفل النص.',
  'Ctrl + S : حفظ المستند.',
  'Ctrl + P : طباعة المستند.',
  'Ctrl + N : إنشاء مستند جديد.',
  'Ctrl + O : فتح مستند.',
  'Ctrl + F : البحث داخل المستند.',
  'Ctrl + H : استبدال الكلمات.',
  'Ctrl + G : الانتقال إلى صفحة محددة.',
  'Ctrl + K : إدراج رابط.',
  'Ctrl + E : محاذاة للوسط.',
  'Ctrl + L : محاذاة لليسار.',
  'Ctrl + R : محاذاة لليمين.',
  'Ctrl + J : ضبط النص (Justify).',
  'Ctrl + Shift + > : تكبير حجم الخط.',
  'Ctrl + Shift + < : تصغير حجم الخط.',
  'Ctrl + Shift + C : نسخ تنسيق النص.',
  'Ctrl + Shift + V : لصق التنسيق.',
  'Ctrl + Enter : إدراج صفحة جديدة.',
  'F7 : التدقيق الإملائي.',
  'Shift + F3 : تحويل بين الأحرف الكبيرة والصغيرة.'
      ]
    },

    {
      id: 3,
      category: 'PRINTERS',
      title: 'الطابعة لا تستجيب لأوامر الطباعة',
      problem: 'إرسال ملف للطباعة ولكن الطابعة تظل صامتة والملف يعلق في صف الانتظار.',
      steps: [
        'تأكد من تشغيل الطابعة وتوصيل كابل الـ USB أو اتصالها بشبكة Wi-Fi الخاصة بالشركة.',
        'افحص شاشة الطابعة للتأكد من عدم وجود رسائل خطأ مثل "حشر ورق" (Paper Jam) أو "نفاذ الحبر" (Low Ink).',
        'افتح "الأجهزة والطابعات" في لوحة التحكم، واضغط بيمين الفأرة على طابعتك ثم اختر "إلغاء جميع المستندات المعلقة" (Cancel all documents).',
        'إذا لم يستجب النظام، أعد تشغيل خدمة الطباعة (Print Spooler) من مدير المهام أو أعد تشغيل جهازك.'
      ]
    },



{
      id: 4,
      category: 'EXCEL',
      title: '  اختصارات تفيدك  ',
      problem: 'هاذي اهم وافضل الاختصارات في برنامج EXCEL .',
      steps: [
  'F2 : تعديل محتوى الخلية.',
  'Ctrl + Arrow : الانتقال إلى آخر البيانات.',
  'Ctrl + Shift + Arrow : تحديد حتى نهاية البيانات.',
  'Ctrl + Space : تحديد العمود بالكامل.',
  'Shift + Space : تحديد الصف بالكامل.',
  'Ctrl + ; : إدراج تاريخ اليوم.',
  'Ctrl + Shift + ; : إدراج الوقت الحالي.',
  'Alt + = : إدراج دالة الجمع التلقائي AutoSum.',
  'Ctrl + 1 : فتح تنسيق الخلايا.',
  'Ctrl + Page Up : الانتقال للورقة السابقة.',
  'Ctrl + Page Down : الانتقال للورقة التالية.',
  'Ctrl + D : نسخ الخلية للأعلى للأسفل.',
  'Ctrl + R : نسخ الخلية لليمين.',
  'Ctrl + ` : إظهار أو إخفاء المعادلات.',
  'F4 : تكرار آخر عملية أو تثبيت مرجع الخلية ($).',
  'Ctrl + Shift + L : تشغيل أو إيقاف الفلترة.',
  'Alt + H + O + I : ضبط عرض العمود تلقائياً.',
  'Ctrl + T : تحويل البيانات إلى جدول.'
]
    },


    {
      id: 5,
      category: 'INTERNET',
      title: 'شبكة الإنترنت منقطعة أو بطيئة جداً',
      problem: 'ظهور علامة تعجب صفراء على أيقونة الشبكة أو عدم القدرة على تصفح المواقع الإلكترونية للشركة.',
      steps: [
        'تأكد من تشغيل اتصال الـ Wi-Fi أو توصيل كابل الشبكة (Ethernet) بشكل محكم.',
        'افصل مقبس الكهرباء عن المودم أو الموزع القريب منك لمدة 10 ثوانٍ ثم أعد تشغيله.',
        'افتح نافذة الشبكات وقم بعمل تعطيل (Disable) ثم تمكين (Enable) لكرت الشبكة لإعادة الاتصال بالخادم.',
        'تأكد من إغلاق برامج التحميل أو البث المباشر التي قد تستهلك كامل سرعة الاتصال.'
      ]
    },



{
      id: 6,
      category: 'PDF',
      title: '  اختصارات تفيدك  ',
      problem: 'هاذي اهم وافضل الاخصتارات في برنامج PDF + تنفع ل ادوبي .',
      steps: [
'Ctrl + + : تكبير الصفحة.',
  'Ctrl + - : تصغير الصفحة.',
  'Ctrl + 0 : ملاءمة الصفحة للشاشة.',
  'Ctrl + 1 : عرض الحجم الحقيقي.',
  'Ctrl + F : البحث داخل الملف.',
  'Ctrl + Shift + F : بحث متقدم.',
  'Ctrl + P : طباعة الملف.',
  'Ctrl + S : حفظ التعديلات.',
  'Ctrl + D : خصائص الملف.',
  'Page Up : الصفحة السابقة.',
  'Page Down : الصفحة التالية.',
  'Home : أول صفحة.',
  'End : آخر صفحة.',
  'Ctrl + L : وضع ملء الشاشة.'
]
    },



    {
      id: 7,
      category: 'SOFTWARE',
      title: 'حساب Microsoft Outlook مقفل ومقيد',
      problem: 'ظهور رسالة تفيد بأن حساب البريد الإلكتروني مقفل بسبب محاولات تسجيل دخول خاطئة متكررة.',
      steps: [
        'انتظر لمدة 15 دقيقة دون محاولة تسجيل الدخول، حيث يقوم النظام التلقائي بفك القفل المؤقت تلقائياً.',
        'استخدم نظام تغيير كلمة المرور الذاتي لشركة MAP UNITED إذا كنت تمتلك الصلاحية.',
        'إذا استمر الإقفال، يرجى الانتقال لقسم "إرسال طلب" وسنقوم بإعادة تعيين كلمة مرورك فوراً.'
      ]
    },



{
      id: 8,
      category: 'WINDOWS',
      title: '  اختصارات تفيدك  ',
      problem: '  هاذي اهم وافضل الاختصارات في windows  .',
      steps: [

  'Win + E : فتح مستكشف الملفات (File Explorer).',
  'Win + D : إظهار أو إخفاء سطح المكتب.',
  'Win + L : قفل الجهاز فوراً.',
  'Win + R : فتح نافذة التشغيل Run.',
  'Win + I : فتح إعدادات ويندوز.',
  'Win + S : فتح البحث في ويندوز.',
  'Win + V : فتح سجل الحافظة (Clipboard History).',
  'Win + Shift + S : التقاط جزء من الشاشة.',
  'Win + PrtSc : حفظ لقطة شاشة تلقائياً.',
  'Alt + Tab : التنقل بين البرامج المفتوحة.',
  'Ctrl + Shift + Esc : فتح إدارة المهام مباشرة.',
  'Ctrl + Alt + Delete : فتح قائمة الأمان.',
  'Alt + F4 : إغلاق النافذة الحالية.',
  'F2 : إعادة تسمية ملف أو مجلد.',
  'F5 : تحديث الصفحة أو المجلد.',
  'Ctrl + A : تحديد جميع العناصر.',
  'Ctrl + C : نسخ.',
  'Ctrl + X : قص.',
  'Ctrl + V : لصق.',
  'Ctrl + Z : تراجع.',
  'Ctrl + Y : إعادة آخر عملية.',
  'Ctrl + Shift + N : إنشاء مجلد جديد.',
  'Shift + Delete : حذف نهائي بدون سلة المحذوفات.',
  'Win + Tab : عرض جميع النوافذ وسطح المكتب الافتراضي.',
  'Win + ← أو → : تثبيت النافذة يمين أو يسار الشاشة.',
  'Win + ↑ : تكبير النافذة.',
  'Win + ↓ : تصغير أو استعادة النافذة.',
  'Ctrl + Mouse Wheel : تكبير أو تصغير العرض.',
  'Ctrl + Shift + T : استعادة آخر تبويب مغلق في المتصفح.',
  'Ctrl + T : فتح تبويب جديد.',
  'Ctrl + W : إغلاق التبويب الحالي.',
  'Ctrl + Tab : الانتقال للتبويب التالي.',
  'Ctrl + Shift + Tab : الانتقال للتبويب السابق.'
]

 },




    {
      id: 9,
      category: 'EMAIL',
      title: 'مشكلة في استقبال أو إرسال الإيميلات',
      problem: 'عدم القدرة على إرسال رسائل جديدة أو عدم ظهور الرسائل الواردة الحديثة في الصندوق.',
      steps: [
        'تأكد من أن تطبيق Outlook في وضع الاتصال (Connected to Exchange) وليس في وضع العمل دون اتصال (Work Offline).',
        'تحقق من مساحة صندوق البريد الخاصة بك، واحذف الرسائل القديمة أو المرفقات الكبيرة لتبسيط السعة.',
        'تفقد مجلد "البريد المهمل" (Junk Email) فقد تكون الرسائل الواردة قد تم تصنيفها بشكل خاطئ هناك.',
        'أعد تشغيل تطبيق Outlook وجرب إرسال رسالة تجريبية لنفسك.'
      ]
    },
     

     
     
  {
      id: 10,
      category: 'GENERAL',
      title: ' اختصارات تفيدك',
      problem: ' هاذي اهم الاختصارات العامه تفيدك  .',
      steps: [
        'Ctrl + + : تكبير الصفحة.',
        'Ctrl + - : تصغير الصفحة.',
        'Ctrl + 0 : ملاءمة الصفحة للشاشة.',
        'Ctrl + 1 : عرض الحجم الحقيقي.',
        'Ctrl + F : البحث داخل الملف.',
        'Ctrl + Shift + F : بحث متقدم.',
        'Ctrl + P : طباعة الملف.',
        'Ctrl + S : حفظ التعديلات.',
        'Ctrl + D : خصائص الملف.',
        'Page Up : الصفحة السابقة.',
        'Page Down : الصفحة التالية.',
        'Home : أول صفحة.',
        'End : آخر صفحة.',
        'Ctrl + L : وضع ملء الشاشة.'
]
    }

  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          faq.problem.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
          <HelpCircle className="text-primary-500" size={28} />
          من هنا فيه عده مشاكل معروفه , يمديك تشوف مشكلتك اذا موجوده بشكل بسيط وسهل , واذا مو موجوده افتح تذكره وابشر بالخير ان شاء الله
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          اختر نوع المشكلة التي تواجهك لعرض الحلول الفورية المدعومة من فريق IT قبل إرسال طلب جديد.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!activeFaq ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute right-3 top-3.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="ابحث عن المشكلة... (مثال: شاشة، طابعة، إيميل)"
                  className="input-field pr-10 w-full"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="input-field w-full"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* FAQ Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map(faq => (
                  <div
                    key={faq.id}
                    onClick={() => setActiveFaq(faq)}
                    className="card hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-md cursor-pointer transition-all duration-200 group flex justify-between items-center"
                  >
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                        {categories.find(c => c.value === faq.category)?.label}
                      </span>
                      <h4 className="text-base font-bold text-gray-800 dark:text-gray-200 mt-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {faq.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                        {faq.problem}
                      </p>
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-primary-500 group-hover:translate-x-[-4px] transition-all" size={20} />
                  </div>
                ))
              ) : (
                <div className="col-span-full card text-center py-12 text-gray-400">
                  <HelpCircle size={48} className="mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">عذراً، لم نجد حلولاً مطابقة لبحثك.</p>
                  <button
                    onClick={() => navigate('/dashboard/tickets/new')}
                    className="btn-primary mt-4 inline-flex items-center gap-2"
                  >
                    <Send size={16} />
                    إنشاء طلب دعم فني مباشر للـ IT
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card space-y-6 shadow-xl border-primary-100 dark:border-primary-900/30"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setActiveFaq(null)}
                className="text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <ArrowLeft size={18} />
                العودة لقائمة الحلول الشائعة
              </button>
              <span className="text-xs font-bold px-3 py-1 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                {categories.find(c => c.value === activeFaq.category)?.label}
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{activeFaq.title}</h3>
              <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/30 rounded-lg p-4 text-sm text-red-800 dark:text-red-300">
                <strong>المشكلة الشائعة: </strong> {activeFaq.problem}
              </div>
            </div>

            {/* Step by Step Guide */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 dark:text-gray-200">  ركز ع الخطوات وكلشي بيكون تمام ان شاء الله</h4>
              <div className="space-y-3">
                {activeFaq.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bottom */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">المشكلة لا تزال مستمرة ولم يتم حلها بالخطوات السابقة؟</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">لا تقلق، يمكنك تحويل هذه المشكلة إلى طلب دعم فني مباشر وسيقوم فريقنا بمساعدتك.</p>
              </div>
              <button
                onClick={() => navigate('/dashboard/tickets/new', { state: { category: activeFaq.category } })}
                className="btn-primary flex items-center gap-2 shrink-0 justify-center"
              >
                <Send size={16} />
                إرسال طلب دعم للـ IT ←
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Faq;
