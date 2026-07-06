import { Op } from 'sequelize';
import { Ticket, Reply, Attachment, User } from '../models/index.js';
import { getIo } from '../sockets/index.js';

const ALLOWED_CATEGORIES = ['HARDWARE', 'PRINTERS', 'INTERNET', 'NETWORK', 'SOFTWARE', 'EMAIL', 'BILLING', 'OTHER'];
const ALLOWED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALLOWED_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const ALLOWED_BILLING_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 5000;

export const createTicket = async (req, res) => {
  try {
    const { title, description, category, softwareName, priority, billingItems } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: 'العنوان والوصف والتصنيف مطلوبة.' });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'تصنيف غير صالح.' });
    }
    if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: 'أولوية غير صالحة.' });
    }
    if (title.length > MAX_TITLE_LEN) {
      return res.status(400).json({ message: 'العنوان طويل جداً.' });
    }
    if (description.length > MAX_DESCRIPTION_LEN) {
      return res.status(400).json({ message: 'الوصف طويل جداً.' });
    }

    if (category === 'BILLING' && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'صورة الفاتورة أو المرفق إجباري لطلبات الفواتير.' });
    }

    let parsedBillingItems = null;
    if (category === 'BILLING' && billingItems) {
      try {
        parsedBillingItems = typeof billingItems === 'string' ? JSON.parse(billingItems) : billingItems;
        if (!Array.isArray(parsedBillingItems)) parsedBillingItems = null;
      } catch {
        return res.status(400).json({ message: 'بيانات الفاتورة غير صالحة.' });
      }
    }

    const ticket = await Ticket.create({
      companyId: req.user.companyId,
      employeeId: req.user.id,
      title,
      description,
      category,
      softwareName: category === 'SOFTWARE' ? softwareName : null,
      priority: priority || 'MEDIUM',
      status: 'OPEN',
      billingItems: parsedBillingItems,
      billingStatus: category === 'BILLING' ? 'PENDING' : null,
    });

    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(file => ({
        ticketId: ticket.id,
        fileName: file.originalname,
        fileUrl: file.path.replace(/\\/g, '/'),
        fileType: file.mimetype,
      }));
      await Attachment.bulkCreate(attachments);
    }

    const io = getIo();
    if (category === 'BILLING') {
      io.to(`role_${req.user.companyId}_ADMIN`).emit('new_ticket', ticket);
    } else {
      io.to(`role_${req.user.companyId}_IT_SUPPORT`).emit('new_ticket', ticket);
    }

    return res.status(201).json(ticket);
  } catch (error) {
    console.error('[createTicket]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const getTickets = async (req, res) => {
  try {
    const { role, companyId, id: userId } = req.user;
    const { archive } = req.query;

    let whereClause = { companyId };

    if (role === 'EMPLOYEE') {
      whereClause.employeeId = userId;
    } else if (role === 'IT_SUPPORT') {
      whereClause.category = { [Op.ne]: 'BILLING' };
    }
    // ADMIN sees EVERYTHING (regular + billing tickets) so they can claim
    // and reply just like IT_SUPPORT. They retain BILLING approval powers too.
    // SUPER_ADMIN also sees all.

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'Creator', attributes: ['id', 'name', 'email', 'department', 'profileImage'] },
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 500,
    });

    return res.json(tickets);
  } catch (error) {
    console.error('[getTickets]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
      include: [
        { model: User, as: 'Creator', attributes: ['id', 'name', 'email', 'profileImage'] },
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'email', 'profileImage'] },
        { model: Attachment },
        {
          model: Reply,
          include: [
            { model: User, attributes: ['id', 'name', 'role', 'profileImage'] },
            { model: Attachment },
          ],
        },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (req.user.role === 'EMPLOYEE' && ticket.employeeId !== req.user.id) {
      return res.status(403).json({ message: 'لا تملك صلاحية عرض هذه التذكرة.' });
    }
    if (req.user.role === 'IT_SUPPORT' && ticket.category === 'BILLING') {
      return res.status(403).json({ message: 'لا تملك صلاحية عرض تذاكر الفواتير.' });
    }

    return res.json(ticket);
  } catch (error) {
    console.error('[getTicketById]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const updateTicket = async (req, res) => {
  try {
    const { status, assignedTo, billingStatus } = req.body;

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'حالة غير صالحة.' });
    }
    if (billingStatus && !ALLOWED_BILLING_STATUSES.includes(billingStatus)) {
      return res.status(400).json({ message: 'حالة فاتورة غير صالحة.' });
    }

    const ticket = await Ticket.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (billingStatus && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'لا تملك صلاحية تعديل حالة الفاتورة.' });
    }

    // Single-active-ticket enforcement:
    // An IT_SUPPORT user can only have ONE ticket in IN_PROGRESS at a time.
    // We check this when:
    //   (a) they are claiming a ticket (assignedTo === self), OR
    //   (b) they are setting a ticket to IN_PROGRESS
    const isClaimingForSelf =
      assignedTo && assignedTo === req.user.id && req.user.role === 'IT_SUPPORT';
    const isStartingProgress =
      status === 'IN_PROGRESS' && ticket.assignedTo === req.user.id;

    if (isClaimingForSelf || isStartingProgress) {
      const otherActive = await Ticket.findOne({
        where: {
          companyId: req.user.companyId,
          assignedTo: req.user.id,
          status: 'IN_PROGRESS',
          id: { [Op.ne]: ticket.id },
        },
      });
      if (otherActive) {
        return res.status(409).json({
          message: `يجب إنهاء الطلب الحالي #${otherActive.id.slice(0, 8)} قبل استلام طلب جديد.`,
          code: 'ACTIVE_TICKET_EXISTS',
          activeTicketId: otherActive.id,
        });
      }
    }

    if (status) ticket.status = status;

    // Concurrency lock: prevent two IT users from claiming the same ticket.
    if (assignedTo) {
      if (ticket.assignedTo && ticket.assignedTo !== assignedTo) {
        return res.status(409).json({
          message: 'هذا الطلب تم استلامه بالفعل من فني آخر. يرجى تحديث القائمة.',
        });
      }
      ticket.assignedTo = assignedTo;
    }

    if (billingStatus) {
      ticket.billingStatus = billingStatus;
      if (billingStatus === 'APPROVED') {
        ticket.status = 'RESOLVED';
      } else if (billingStatus === 'REJECTED') {
        // Rejected billing → ticket is closed permanently (no more replies)
        ticket.status = 'CLOSED';
      }
    }

    await ticket.save();

    const io = getIo();
    // io.to([roomA, roomB]) sends to the UNION — each socket gets it ONCE.
    io.to([`ticket_${ticket.id}`, `user_${ticket.employeeId}`]).emit('ticket_updated', ticket);

    return res.json(ticket);
  } catch (error) {
    console.error('[updateTicket]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

export const addReply = async (req, res) => {
  try {
    const { message, isSolution } = req.body;

    if (!message || !message.trim()) {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'الرسالة أو المرفقات مطلوبة.' });
      }
    }

    const ticket = await Ticket.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (req.user.role === 'EMPLOYEE' && ticket.employeeId !== req.user.id) {
      return res.status(403).json({ message: 'لا تملك صلاحية الرد على هذه التذكرة.' });
    }
    if (req.user.role === 'IT_SUPPORT' && ticket.category === 'BILLING') {
      return res.status(403).json({ message: 'لا تملك صلاحية الرد على تذاكر الفواتير.' });
    }
    // CLOSED ticket: NOBODY can reply (employee or IT). This includes:
    //   - normal tickets explicitly closed
    //   - BILLING tickets that were REJECTED (auto-closed)
    if (ticket.status === 'CLOSED') {
      return res.status(403).json({ message: 'هذه التذكرة مغلقة، لا يمكن إضافة ردود.' });
    }
    if (ticket.category === 'BILLING' && ticket.billingStatus === 'REJECTED') {
      return res.status(403).json({ message: 'تم رفض هذه الفاتورة، لا يمكن إضافة ردود.' });
    }

    // Employee cannot chat until IT has picked up the ticket (status moved to IN_PROGRESS).
    // BILLING tickets are an exception (handled by ADMIN, not assigned).
    if (
      req.user.role === 'EMPLOYEE' &&
      ticket.status === 'OPEN' &&
      ticket.category !== 'BILLING'
    ) {
      return res.status(403).json({
        message: 'يرجى انتظار استلام الدعم الفني للطلب قبل بدء المحادثة.',
      });
    }

    const canMarkSolution = isSolution === true && req.user.role === 'IT_SUPPORT';

    const reply = await Reply.create({
      ticketId: ticket.id,
      userId: req.user.id,
      message: message || '',
      isSolution: canMarkSolution,
    });

    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(file => ({
        replyId: reply.id,
        fileName: file.originalname,
        fileUrl: file.path.replace(/\\/g, '/'),
        fileType: file.mimetype,
      }));
      await Attachment.bulkCreate(attachments);
    }

    if (canMarkSolution) {
      ticket.status = 'RESOLVED';
      await ticket.save();
    }

    const fullReply = await Reply.findByPk(reply.id, {
      include: [
        { model: User, attributes: ['id', 'name', 'role', 'profileImage'] },
        { model: Attachment },
      ],
    });

    const io = getIo();
    // Single event source: ticket room. Subscribers (incl. recipient) get it once.
    io.to(`ticket_${ticket.id}`).emit('new_reply', fullReply);

    // Personal "you have a new reply on a ticket you are not currently viewing" hint.
    const notifyUserId = req.user.id === ticket.employeeId ? ticket.assignedTo : ticket.employeeId;
    if (notifyUserId) {
      io.to(`user_${notifyUserId}`).emit('reply_hint', {
        ticketId: ticket.id,
        title: ticket.title,
      });
    }

    return res.status(201).json(fullReply);
  } catch (error) {
    console.error('[addReply]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// @desc    Soft-delete a ticket (moves to trash)
// @route   DELETE /api/tickets/:id
// @access  Private (IT_SUPPORT, ADMIN, SUPER_ADMIN)
export const deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!ticket) {
      return res.status(404).json({ message: 'التذكرة غير موجودة.' });
    }

    if (ticket.category === 'BILLING' && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'لا تملك صلاحية حذف تذاكر الفواتير.' });
    }

    const deletedId = ticket.id;
    const employeeId = ticket.employeeId;
    const reason = req.body?.reason || null;

    // Record who deleted it (audit trail)
    ticket.deletedBy = req.user.id;
    ticket.deletedByName = req.user.name;
    ticket.deletedByRole = req.user.role;
    ticket.deletionReason = reason;
    await ticket.save();

    // Soft delete (sets deletedAt — Sequelize handles via paranoid:true)
    await ticket.destroy();

    res.json({ message: 'تم نقل التذكرة لسلة المحذوفات.', id: deletedId });

    const companyId = req.user.companyId;
    setImmediate(() => {
      try {
        const io = getIo();
        io.to([
          `role_${companyId}_IT_SUPPORT`,
          `role_${companyId}_ADMIN`,
          `role_${companyId}_SUPER_ADMIN`,
          `user_${employeeId}`,
          `ticket_${deletedId}`,
        ]).emit('ticket_deleted', { id: deletedId });
      } catch (e) {
        console.error('[deleteTicket socket emit]', e.message);
      }
    });
  } catch (error) {
    console.error('[deleteTicket]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي.' });
    }
  }
};

// @desc    Get all soft-deleted tickets (trash)
// @route   GET /api/tickets/deleted
// @access  Private (IT_SUPPORT, ADMIN, SUPER_ADMIN)
export const getDeletedTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      where: { companyId: req.user.companyId },
      include: [
        { model: User, as: 'Creator', attributes: ['id', 'name', 'email', 'department'] },
        { model: User, as: 'Assignee', attributes: ['id', 'name', 'email'] },
      ],
      order: [['deletedAt', 'DESC']],
      paranoid: false, // ← include soft-deleted
    });
    // Filter to only deleted ones
    const deletedOnly = tickets.filter(t => t.deletedAt !== null);
    return res.json(deletedOnly);
  } catch (error) {
    console.error('[getDeletedTickets]', error);
    return res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};

// @desc    Restore a soft-deleted ticket
// @route   POST /api/tickets/:id/restore
// @access  Private (IT_SUPPORT, ADMIN, SUPER_ADMIN)
export const restoreTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
      paranoid: false,
    });
    if (!ticket) {
      return res.status(404).json({ message: 'التذكرة غير موجودة.' });
    }
    if (!ticket.deletedAt) {
      return res.status(400).json({ message: 'التذكرة ليست محذوفة.' });
    }

    await ticket.restore();

    // Clear deletion audit fields after restore
    ticket.deletedBy = null;
    ticket.deletedByName = null;
    ticket.deletedByRole = null;
    ticket.deletionReason = null;
    await ticket.save();

    res.json({ message: 'تم استعادة التذكرة بنجاح.', id: ticket.id });

    const companyId = req.user.companyId;
    setImmediate(() => {
      try {
        const io = getIo();
        io.to([
          `role_${companyId}_IT_SUPPORT`,
          `role_${companyId}_ADMIN`,
          `role_${companyId}_SUPER_ADMIN`,
          `user_${ticket.employeeId}`,
        ]).emit('ticket_restored', { id: ticket.id, ticket });
      } catch (e) {
        console.error('[restoreTicket socket]', e.message);
      }
    });
  } catch (error) {
    console.error('[restoreTicket]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي.' });
    }
  }
};

// @desc    Permanently delete a ticket (FORCE - cannot be restored)
// @route   DELETE /api/tickets/:id/force
// @access  Private (ADMIN, SUPER_ADMIN only)
export const forceDeleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, companyId: req.user.companyId },
      paranoid: false,
    });
    if (!ticket) {
      return res.status(404).json({ message: 'التذكرة غير موجودة.' });
    }

    const deletedId = ticket.id;

    // Clean related records FIRST
    await Attachment.destroy({ where: { ticketId: deletedId }, force: true });
    await Reply.destroy({ where: { ticketId: deletedId }, force: true });
    await ticket.destroy({ force: true }); // FORCE = hard delete

    res.json({ message: 'تم حذف التذكرة نهائياً.', id: deletedId });

    const companyId = req.user.companyId;
    setImmediate(() => {
      try {
        const io = getIo();
        io.to([
          `role_${companyId}_IT_SUPPORT`,
          `role_${companyId}_ADMIN`,
          `role_${companyId}_SUPER_ADMIN`,
        ]).emit('ticket_force_deleted', { id: deletedId });
      } catch (e) {
        console.error('[forceDeleteTicket socket]', e.message);
      }
    });
  } catch (error) {
    console.error('[forceDeleteTicket]', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'حدث خطأ داخلي.' });
    }
  }
};
