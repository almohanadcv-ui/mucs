import sequelize from './config/database.js';
import { User, Company, Ticket, Reply } from './models/index.js';

const seedData = async () => {
  try {
    const company = await Company.findOne({ where: { subdomain: 'mab' } });
    const itUser = await User.findOne({ where: { email: 'it@mab.com' } });

    if (!company || !itUser) {
      console.log('Company or IT user not found. Run seed.js first.');
      process.exit();
    }

    console.log('⏳ جاري إضافة بيانات واقعية للنظام...');

    // 1. Create realistic Employees
    const employeesData = [
      { name: 'أحمد محمد', email: 'ahmed@mab.com', department: 'HR', role: 'EMPLOYEE', isActive: true, password: 'password123' },
      { name: 'سارة خالد', email: 'sara@mab.com', department: 'Marketing', role: 'EMPLOYEE', isActive: true, password: 'password123' },
      { name: 'فهد عبدالله', email: 'fahad@mab.com', department: 'Sales', role: 'EMPLOYEE', isActive: false, password: 'password123' }, // Pending user
      { name: 'نورة عبدالعزيز', email: 'noura@mab.com', department: 'Finance', role: 'EMPLOYEE', isActive: true, password: 'password123' }
    ];

    const createdEmployees = [];
    for (const emp of employeesData) {
      const existing = await User.findOne({ where: { email: emp.email } });
      if (!existing) {
        const newEmp = await User.create({ ...emp, companyId: company.id });
        createdEmployees.push(newEmp);
      } else {
        createdEmployees.push(existing);
      }
    }

    // 2. Create realistic Tickets
    const ticketsData = [
      {
        employeeId: createdEmployees[0].id,
        title: 'الطابعة لا تعمل في قسم الموارد البشرية',
        description: 'السلام عليكم، طابعة القسم تظهر رسالة خطأ باللون الأحمر ولا تستجيب للطباعة من الشبكة.',
        category: 'PRINTERS',
        status: 'OPEN',
        priority: 'HIGH'
      },
      {
        employeeId: createdEmployees[1].id,
        title: 'مشكلة في تفعيل برنامج Adobe Photoshop',
        description: 'رخصة البرنامج انتهت وتظهر لي شاشة تطالب بالشراء، أحتاج تفعيل الرخصة الخاصة بالشركة.',
        category: 'SOFTWARE',
        softwareName: 'Adobe Photoshop',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        assignedTo: itUser.id
      },
      {
        employeeId: createdEmployees[3].id,
        title: 'طلب تحديث بيانات الفوترة للشركة',
        description: 'يوجد فاتورة معلقة خاصة باشتراكات الإنترنت يجب مراجعتها واعتمادها.',
        category: 'BILLING', // This will go to Admin
        status: 'OPEN',
        priority: 'CRITICAL'
      },
      {
        employeeId: createdEmployees[0].id,
        title: 'انقطاع متكرر في شبكة الـ Wi-Fi',
        description: 'الشبكة تفصل كل 10 دقائق وتؤثر على اجتماع التوظيف.',
        category: 'NETWORK',
        status: 'RESOLVED',
        priority: 'HIGH',
        assignedTo: itUser.id
      },
      {
        employeeId: createdEmployees[1].id,
        title: 'جهازي بطيء جداً',
        description: 'الجهاز يأخذ أكثر من 10 دقائق للتشغيل والبرامج تعلق باستمرار.',
        category: 'HARDWARE',
        status: 'CLOSED',
        priority: 'LOW',
        assignedTo: itUser.id
      }
    ];

    for (const t of ticketsData) {
      const existing = await Ticket.findOne({ where: { title: t.title } });
      if (!existing) {
        const newTicket = await Ticket.create({ ...t, companyId: company.id });
        
        // Add a reply to the resolved ticket
        if (newTicket.status === 'RESOLVED' || newTicket.status === 'IN_PROGRESS') {
          await Reply.create({
            ticketId: newTicket.id,
            userId: itUser.id,
            message: newTicket.status === 'RESOLVED' ? 'تم إعادة تشغيل موزع الشبكة (Router) وتحديث الإعدادات، يرجى التأكد من استقرار الاتصال الآن.' : 'جاري العمل على طلب رخصة جديدة من قسم المشتريات، سيتم التحديث قريباً.',
            isSolution: newTicket.status === 'RESOLVED'
          });
        }
      }
    }

    console.log('✅ تمت إضافة البيانات بنجاح! الموقع الآن مليء بالتذاكر والمستخدمين كأنه نظام يعمل منذ فترة.');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    process.exit();
  }
};

seedData();
