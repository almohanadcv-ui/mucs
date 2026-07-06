import jwt from 'jsonwebtoken';
import { User, Company, Ticket } from '../models/index.js';
import generateToken from '../utils/generateToken.js';
import { getIo } from '../sockets/index.js';
import { sendActivationEmail, sendPasswordResetEmail } from '../utils/email.js';
import {
  recordSuccessfulLogin,
  recordFailedLogin,
  recordPasswordChange,
} from '../utils/securityEvents.js';

const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  return /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[@$!%*?&#]/.test(password);
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

export const registerCompany = async (req, res) => {
  try {
    const { companyName, subdomain, userName, email, password } = req.body;

    if (!companyName || !subdomain || !userName || !email || !password) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'كلمة المرور ضعيفة. يجب 8 أحرف+، حرف كبير وصغير ورقم ورمز خاص (@$!%*?&).' });
    }

    const companyExists = await Company.findOne({ where: { subdomain } });
    if (companyExists) return res.status(400).json({ message: 'النطاق الفرعي مسجل مسبقاً.' });

    const userExists = await User.findOne({ where: { email } });
    if (userExists) return res.status(400).json({ message: 'المستخدم مسجل مسبقاً.' });

    const company = await Company.create({ name: companyName, subdomain });
    const user = await User.create({
      companyId: company.id,
      name: userName,
      email,
      password,
      role: 'SUPER_ADMIN',
      isActive: true,
    });

    const token = generateToken(user.id, user.role, user.companyId);
    user.currentSessionToken = token;
    await user.save();

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      token,
    });
  } catch (error) {
    console.error('[registerCompany]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.' });
  }
};

export const registerEmployee = async (req, res) => {
  // Public self-registration is DISABLED by policy. Only SUPER_ADMIN can
  // create accounts via the Users page.
  return res.status(403).json({
    message: 'التسجيل العام معطّل. يرجى التواصل مع مدير النظام لإنشاء حسابك.',
    code: 'REGISTRATION_DISABLED',
  });
  // eslint-disable-next-line no-unreachable
  try {
    const { name, email, department, location } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'الاسم والبريد الإلكتروني مطلوبان.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
    }

    let company = await Company.findOne({ where: { subdomain: 'mab' } });
    if (!company) {
      company = await Company.findOne();
    }
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة. يرجى تهيئة النظام.' });
    }

    const userExists = await User.findOne({ where: { email } });
    if (userExists) return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً.' });

    const newEmployee = await User.create({
      companyId: company.id,
      name,
      email,
      department,
      location: location || null,
      role: 'EMPLOYEE',
      isActive: false,
    });

    const ticket = await Ticket.create({
      companyId: company.id,
      employeeId: newEmployee.id,
      title: `طلب إنشاء حساب جديد - ${name}`,
      description: `طلب تسجيل جديد:\nالاسم: ${name}\nالبريد الإلكتروني: ${email}\nالقسم: ${department || 'غير محدد'}\nالموقع: ${location || 'غير محدد'}\n\nيرجى مراجعة الطلب وتفعيل الحساب.`,
      category: 'OTHER',
      status: 'OPEN',
      priority: 'MEDIUM',
    });

    // Single source of truth: new_user_registration handles the toast,
    // new_ticket only goes to the lists so they refresh without re-toasting.
    const io = getIo();
    io.to(`role_${company.id}_IT_SUPPORT`).emit('new_user_registration');
    io.to(`role_${company.id}_IT_SUPPORT`).emit('new_ticket', { ...ticket.toJSON(), _silent: true });
    io.to(`role_${company.id}_ADMIN`).emit('new_ticket', { ...ticket.toJSON(), _silent: true });

    return res.status(201).json({ message: 'تم إرسال طلب تفعيل الحساب بنجاح. يرجى انتظار رد الدعم الفني.' });
  } catch (error) {
    console.error('[registerEmployee]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.' });
  }
};

export const checkRequestStatus = async (req, res) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'لا يوجد طلب مسجل بهذا البريد الإلكتروني.' });
    if (user.isActive) {
      return res.json({ status: 'ACTIVE', message: 'حسابك مفعل. يرجى تفقد بريدك الإلكتروني للحصول على رمز الدخول.' });
    }
    return res.json({ status: 'PENDING', message: 'طلبك لا يزال قيد المراجعة من قبل قسم الدعم الفني.' });
  } catch (error) {
    console.error('[checkRequestStatus]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.' });
  }
};

// Schedule a security log AFTER the response is flushed.
// Never let logging slow the auth path.
const logAfter = (fn) => setImmediate(() => { try { fn(); } catch (e) { console.error('[bg log]', e.message); } });

export const loginUser = async (req, res) => {
  try {
    const { email, password, portalRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان.' });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Company, attributes: ['id', 'name', 'subdomain'] }],
    });

    if (!user) {
      res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      logAfter(() => recordFailedLogin(req, 'user_not_found', email));
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'حسابك غير مفعل بعد.' });
      logAfter(() => recordFailedLogin(req, 'inactive_account', email));
      return;
    }

    if (portalRole) {
      if (portalRole === 'employee' && user.role !== 'EMPLOYEE') {
        res.status(403).json({ message: 'عذراً، هذا الحساب غير مسجل كموظف.' });
        logAfter(() => recordFailedLogin(req, 'wrong_portal', email));
        return;
      }
      if (portalRole === 'admin' && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        res.status(403).json({ message: 'عذراً، هذا الحساب ليس لديه صلاحيات الإدارة.' });
        logAfter(() => recordFailedLogin(req, 'wrong_portal', email));
        return;
      }
      if (portalRole === 'it' && user.role !== 'IT_SUPPORT') {
        res.status(403).json({ message: 'عذراً، هذا الحساب غير مسجل كدعم فني.' });
        logAfter(() => recordFailedLogin(req, 'wrong_portal', email));
        return;
      }
    }

    // Two acceptable secrets:
    //   1) bcrypt password (the auto-generated initial password OR the user's
    //      own password after first change)
    //   2) legacy temporaryCode (older flow — still honoured for back-compat)
    const matchesPassword = await user.matchPassword(password);
    const matchesTempCode = !!(user.temporaryCode && password === user.temporaryCode);

    if (!matchesPassword && !matchesTempCode) {
      res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      logAfter(() => recordFailedLogin(req, matchesTempCode ? 'bad_temp_code' : 'bad_password', email));
      return;
    }

    // First-login: force the password-change flow before issuing a session.
    if (user.requiresPasswordChange) {
      return res.json({
        requirePasswordChange: true,
        email: user.email,
        message: 'يجب تغيير كلمة المرور عند أول دخول.',
      });
    }

    const ok = matchesPassword;
    if (!ok) {
      // Should never get here given the above, but keeps the existing audit
      // call sites valid.
      res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      logAfter(() => recordFailedLogin(req, 'bad_password', email));
      return;
    }

    // Single-device enforcement (first-device-wins):
    // If there is a currentSessionToken AND it is still a valid JWT,
    // someone else is logged in. Reject unless the client explicitly opts to
    // force a takeover (forceLogin=true) — which kicks the other device out.
    // If the stored token is expired/invalid, treat the slot as free.
    const forceLogin = req.body.forceLogin === true || req.body.forceLogin === 'true';
    if (user.currentSessionToken && !forceLogin) {
      try {
        jwt.verify(user.currentSessionToken, process.env.JWT_SECRET);
        res.status(409).json({
          message: 'هذا الحساب مسجّل دخول من جهاز آخر.',
          code: 'ALREADY_LOGGED_IN',
          canForceLogin: true,
        });
        logAfter(() => recordFailedLogin(req, 'already_logged_in', email));
        return;
      } catch {
        // expired / tampered — proceed to overwrite
      }
    }

    const token = generateToken(user.id, user.role, user.companyId);
    user.currentSessionToken = token;
    await user.save();

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      location: user.location,
      company: user.Company,
      profileImage: user.profileImage,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      token,
    });
    logAfter(() => recordSuccessfulLogin(req, user));
  } catch (error) {
    console.error('[loginUser]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.' });
    }
  }
};

export const changeFirstPassword = async (req, res) => {
  try {
    // `temporaryCode` is the LEGACY field name from the old flow. In the new
    // flow, the user types their auto-generated initial password — same
    // endpoint. So we accept whichever the client sends and verify against
    // both temporaryCode (legacy) and the bcrypt password (current).
    const { email, temporaryCode, newPassword } = req.body;
    const providedSecret = temporaryCode;

    if (!email || !providedSecret || !newPassword) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'بيانات غير صحيحة.' });

    const matchesLegacyTemp = !!(user.temporaryCode && user.temporaryCode === providedSecret);
    const matchesBcrypt = await user.matchPassword(providedSecret);

    if (!matchesLegacyTemp && !matchesBcrypt) {
      return res.status(400).json({ message: 'بيانات غير صحيحة.' });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ message: 'كلمة المرور ضعيفة: يجب 8 أحرف+، حرف كبير وصغير ورقم ورمز خاص (@$!%*?&).' });
    }

    user.password = newPassword;
    user.temporaryCode = null;
    user.requiresPasswordChange = false;
    const token = generateToken(user.id, user.role, user.companyId);
    user.currentSessionToken = token;
    await user.save();

    res.json({
      message: 'تم تعيين كلمة المرور بنجاح.',
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      token,
    });
    logAfter(() => recordPasswordChange(req, user.email));
  } catch (error) {
    console.error('[changeFirstPassword]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.' });
    }
  }
};

export const forgotPassword = async (req, res) => {
  // Always respond the same way to prevent email enumeration attacks
  const genericMsg = 'إذا كان البريد مسجلاً، سيتم إرسال رمز استعادة إليه قريباً.';

  const { email } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
  }

  // Respond IMMEDIATELY — don't make the user wait for DB + SMTP.
  // The actual work happens in the background.
  res.json({ message: genericMsg });

  setImmediate(async () => {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user || !user.isActive) return;

      const tempCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.temporaryCode = tempCode;
      user.requiresPasswordChange = true;
      await user.save();

      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n=== 🔐 FORGOT PASSWORD CODE ===\nEmail: ${user.email}\nCode: ${tempCode}\n================================\n`);
      }

      sendPasswordResetEmail(user.email, user.name, tempCode).catch(err => {
        console.error('[forgotPassword email]', err);
      });
    } catch (error) {
      console.error('[forgotPassword bg]', error);
    }
  });
};

// Clears the user's currentSessionToken so another device can log in.
// Idempotent — safe even if the token is already null.
export const logoutUser = async (req, res) => {
  try {
    if (req.user) {
      req.user.currentSessionToken = null;
      await req.user.save();
    }
    return res.json({ message: 'تم تسجيل الخروج.' });
  } catch (err) {
    console.error('[logoutUser]', err);
    return res.json({ message: 'تم تسجيل الخروج.' }); // never block logout
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'plainPassword', 'temporaryCode'] },
      include: [{ model: Company, attributes: ['id', 'name', 'subdomain'] }],
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('[getUserProfile]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};
