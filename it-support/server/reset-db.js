import sequelize from './config/database.js';
import { User, Company, Ticket, Reply, Attachment, Notification } from './models/index.js';

const resetDb = async () => {
  try {
    console.log('جاري تصفير قاعدة البيانات...');

    // Force sync drops all tables and recreates them cleanly
    await sequelize.sync({ force: true });

    console.log('تم تفريغ قاعدة البيانات بنجاح.');

    // Create the primary company
    const company = await Company.create({
      name: 'MAB UNITED',
      subdomain: 'mab'
    });

    // Create ONLY the IT Support user as requested
    await User.create({
      companyId: company.id,
      name: 'الدعم الفني',
      email: 'it@mab.com',
      password: 'password123',
      role: 'IT_SUPPORT',
      isActive: true,
      requiresPasswordChange: false
    });

    console.log('✅ تم تصفير النظام! الحساب الوحيد الموجود الآن هو الدعم الفني: it@mab.com');

  } catch (error) {
    console.error('Error resetting db:', error);
  } finally {
    process.exit();
  }
};

resetDb();
