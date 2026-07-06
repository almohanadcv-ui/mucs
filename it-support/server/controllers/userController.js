import { User, Ticket, Reply, Notification, Attachment } from '../models/index.js';
import { sendActivationEmail } from '../utils/email.js';
import { getIo } from '../sockets/index.js';
import { recordActivity } from '../utils/activityTracker.js';
import { PERMISSIONS, PERMISSION_KEYS } from '../utils/permissions.js';

const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  return /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[@$!%*?&#]/.test(password);
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

const allowedRoles = ['EMPLOYEE', 'IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'];

// Auto-generate a strong default password that satisfies isStrongPassword.
// Excludes ambiguous chars (0/O, 1/l/I) so admins can read it aloud.
const generatePassword = (len = 10) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const specials = '@$!%*?&';
  const all = upper + lower + digits + specials;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(specials);
  for (let i = 4; i < len; i++) pw += pick(all);
  return pw.split('').sort(() => 0.5 - Math.random()).join('');
};

// SUPER_ADMIN accounts are protected: nobody except the SUPER_ADMIN themselves
// can view their password, edit them, or delete them.
const isProtectedSuperAdmin = (targetUser, requester) =>
  targetUser?.role === 'SUPER_ADMIN' && targetUser.id !== requester?.id;

export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { companyId: req.user.companyId },
      attributes: { exclude: ['password'] },
    });
    // Strip the cleartext password + activation code from any SUPER_ADMIN
    // account other than the requester themselves. Even another SUPER_ADMIN
    // (if multiples exist) cannot read these for SUPER_ADMINs.
    const sanitized = users.map((u) => {
      const obj = u.toJSON();
      if (isProtectedSuperAdmin(obj, req.user)) {
        obj.plainPassword = null;
        obj.temporaryCode = null;
        obj.currentSessionToken = null;
      }
      return obj;
    });
    return res.json(sanitized);
  } catch (error) {
    console.error('[getUsers]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const activateUser = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
    if (!user) {
      return res.status(404).json({ message: 'الموظف غير موجود.' });
    }
    if (isProtectedSuperAdmin(user, req.user)) {
      return res.status(403).json({ message: 'لا يمكن تعديل حساب مدير عام آخر.' });
    }

    const tempCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.isActive = true;
    user.temporaryCode = tempCode;
    user.requiresPasswordChange = true;
    await user.save();

    // Send response IMMEDIATELY
    res.json({
      message: 'تم تفعيل الحساب وإرسال الرمز المؤقت عبر البريد الإلكتروني.',
      user: { id: user.id, isActive: user.isActive },
      tempCode,
    });

    // All other work AFTER the response has flushed
    const companyId = req.user.companyId;
    setImmediate(() => {
      try {
        const io = getIo();
        io.to([
          `role_${companyId}_IT_SUPPORT`,
          `role_${companyId}_ADMIN`,
          `role_${companyId}_SUPER_ADMIN`,
        ]).emit('user_activated', { id: user.id });
      } catch (e) {
        console.error('[activateUser socket emit]', e.message);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n=== 🔐 TEMP CODE ===\nEmail: ${user.email}\nTemp Code: ${tempCode}\n====================\n`);
      }

      sendActivationEmail(user.email, user.name, tempCode).catch(err => console.error('Email error:', err));
    });
  } catch (error) {
    console.error('[activateUser]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي.' });
    }
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, role, department, location } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'الاسم والبريد الإلكتروني مطلوبان.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صالح.' });
    }

    const desiredRole = role && allowedRoles.includes(role) ? role : 'EMPLOYEE';

    if (desiredRole === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'لا تملك صلاحية إنشاء حساب SUPER_ADMIN.' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً لموظف آخر.' });
    }

    // Auto-generate a strong random password — admin doesn't pick it.
    const generatedPassword = generatePassword(10);

    const newUser = await User.create({
      companyId: req.user.companyId,
      name,
      email,
      password: generatedPassword,
      role: desiredRole,
      department,
      location: location || null,
      isActive: true,
      // Force change-password flow on first login
      requiresPasswordChange: true,
    });

    recordActivity(req, 'user.create', {
      targetId: newUser.id,
      targetName: newUser.name,
      details: `${newUser.email} — ${newUser.role}`,
    });

    res.status(201).json({
      message: 'تم إضافة الموظف الجديد بنجاح',
      // Surface the password to the admin ONCE so they can hand it over
      generatedPassword,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        isActive: newUser.isActive,
      },
    });

    // Broadcast AFTER response
    const companyId = req.user.companyId;
    setImmediate(() => {
      try {
        const io = getIo();
        io.to([
          `role_${companyId}_IT_SUPPORT`,
          `role_${companyId}_ADMIN`,
          `role_${companyId}_SUPER_ADMIN`,
        ]).emit('user_created', { id: newUser.id });
      } catch (e) {
        console.error('[createUser socket emit]', e.message);
      }
    });
    return;
  } catch (error) {
    console.error('[createUser]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي.' });
    }
  }
};

export const updateUserPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'كلمة المرور ضعيفة: يجب 8 أحرف+، حرف كبير وصغير ورقم ورمز خاص (@$!%*?&).' });
    }

    const user = await User.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!user) {
      return res.status(404).json({ message: 'الموظف غير موجود.' });
    }

    // Hard-block: nobody except the SUPER_ADMIN themselves can change their password
    if (isProtectedSuperAdmin(user, req.user)) {
      return res.status(403).json({ message: 'لا يمكن تعديل كلمة مرور مدير عام آخر.' });
    }

    user.password = password;
    user.requiresPasswordChange = false;
    user.temporaryCode = null;
    await user.save();

    recordActivity(req, 'user.password_changed', {
      targetId: user.id,
      targetName: user.name,
    });
    return res.json({ message: 'تم تعديل الرمز السري للموظف بنجاح.' });
  } catch (error) {
    console.error('[updateUserPassword]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// Return the master permissions catalog (for the admin UI)
export const getPermissionsCatalog = async (req, res) => {
  return res.json({ permissions: Object.values(PERMISSIONS) });
};

// Update a single user's granular permissions
export const updateUserPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'permissions يجب أن يكون مصفوفة.' });
    }
    // Sanitise: keep only known keys
    const cleaned = permissions.filter((p) => PERMISSION_KEYS.includes(p));

    const user = await User.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!user) return res.status(404).json({ message: 'الموظف غير موجود.' });

    if (isProtectedSuperAdmin(user, req.user)) {
      return res.status(403).json({ message: 'لا يمكن تعديل صلاحيات مدير عام آخر.' });
    }

    user.permissions = cleaned;
    await user.save();

    recordActivity(req, 'user.permissions_changed', {
      targetId: user.id,
      targetName: user.name,
      details: `الصلاحيات الجديدة: ${cleaned.length ? cleaned.join(', ') : 'لا شيء'}`,
    });

    // Notify the target user (if currently online) to refresh their profile
    setImmediate(() => {
      try {
        const io = getIo();
        io.to(`user_${user.id}`).emit('permissions_updated', { permissions: cleaned });
      } catch (e) {
        console.error('[updateUserPermissions socket]', e.message);
      }
    });

    return res.json({ message: 'تم تحديث الصلاحيات.', permissions: cleaned });
  } catch (err) {
    console.error('[updateUserPermissions]', err);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!userToDelete) {
      return res.status(404).json({ message: 'الموظف غير موجود.' });
    }

    if (userToDelete.id === req.user.id) {
      return res.status(400).json({ message: 'لا يمكنك حذف حسابك الشخصي.' });
    }

    // SUPER_ADMIN accounts can only be deleted by themselves (which is blocked
    // by the line above). In effect: SUPER_ADMINs cannot be deleted by anyone.
    if (isProtectedSuperAdmin(userToDelete, req.user)) {
      return res.status(403).json({ message: 'لا يمكن حذف حساب مدير عام.' });
    }

    const deletedId = userToDelete.id;

    // Manually clean up related records to avoid FK constraint hangs.
    // Order matters: children → parents.
    const userTickets = await Ticket.findAll({
      where: { employeeId: deletedId },
      attributes: ['id'],
    });
    const ticketIds = userTickets.map(t => t.id);

    if (ticketIds.length > 0) {
      await Attachment.destroy({ where: { ticketId: ticketIds } });
      await Reply.destroy({ where: { ticketId: ticketIds } });
      await Ticket.destroy({ where: { id: ticketIds } });
    }

    // Replies the user authored on OTHER tickets
    await Reply.destroy({ where: { userId: deletedId } });

    // Tickets assigned to this user → set null so we don't orphan them
    await Ticket.update({ assignedTo: null }, { where: { assignedTo: deletedId } });

    // Notifications addressed to this user
    await Notification.destroy({ where: { userId: deletedId } });

    await userToDelete.destroy();

    recordActivity(req, 'user.delete', {
      targetId: deletedId,
      targetName: userToDelete.name,
      details: userToDelete.email,
    });
    res.json({ message: 'تم حذف الموظف من قاعدة البيانات بنجاح.' });

    // Broadcast AFTER response is sent
    setImmediate(() => {
      try {
        const io = getIo();
        io.to([
          `role_${req.user.companyId}_IT_SUPPORT`,
          `role_${req.user.companyId}_ADMIN`,
          `role_${req.user.companyId}_SUPER_ADMIN`,
        ]).emit('user_deleted', { id: deletedId });
      } catch (e) {
        console.error('[deleteUser socket emit]', e.message);
      }
    });
  } catch (error) {
    console.error('[deleteUser]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي.' });
    }
  }
};
