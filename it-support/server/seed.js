import sequelize from './config/database.js';
import { User, Company } from './models/index.js';

const seed = async () => {
  try {
    let company = await Company.findOne({ where: { subdomain: 'mab' } });
    
    // إذا لم تكن الشركة موجودة (المستخدم لم يقم بإنشائها مسبقاً)، سنقوم بإنشائها الآن
    if (!company) {
      company = await Company.create({
        name: 'MAB UNITED',
        subdomain: 'mab'
      });
      console.log('✅ تم إنشاء شركة mab بنجاح!');

      // إنشاء حساب المدير العام
      await User.create({
        companyId: company.id,
        name: 'المدير العام',
        email: 'admin@mab.com',
        password: 'password123',
        role: 'SUPER_ADMIN',
        isActive: true
      });
      console.log('✅ تم إنشاء حساب المدير (admin@mab.com) بنجاح!');
    }

    // إنشاء وتفعيل حساب الدعم الفني
    let itUser = await User.findOne({ where: { email: 'it@mab.com' } });
    
    if (itUser) {
      itUser.role = 'IT_SUPPORT';
      itUser.isActive = true;
      itUser.password = 'password123';
      await itUser.save();
      console.log('✅ تم ترقية حساب الدعم الفني بنجاح وتفعيله!');
    } else {
      await User.create({
        companyId: company.id,
        name: 'فريق الدعم الفني',
        email: 'it@mab.com',
        password: 'password123',
        role: 'IT_SUPPORT',
        isActive: true
      });
      console.log('✅ تم إنشاء حساب الدعم الفني (it@mab.com) بنجاح!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
};

seed();
