import { Op } from 'sequelize';
import { Ticket, User } from '../models/index.js';

// @desc    Get dashboard statistics
// @route   GET /api/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const { companyId, role, id: userId } = req.user;
    let ticketWhere = { companyId };
    
    if (role === 'EMPLOYEE') {
      ticketWhere.employeeId = userId;
    } else if (role === 'IT_SUPPORT') {
      ticketWhere.category = { [Op.ne]: 'BILLING' };
    } else if (role === 'ADMIN') {
      ticketWhere.category = 'BILLING';
    }

    const totalTickets = await Ticket.count({ where: ticketWhere });
    const openTickets = await Ticket.count({ where: { ...ticketWhere, status: 'OPEN' } });
    const closedTickets = await Ticket.count({ where: { ...ticketWhere, status: 'CLOSED' } });
    const resolvedTickets = await Ticket.count({ where: { ...ticketWhere, status: 'RESOLVED' } });
    
    const totalUsers = await User.count({ where: { companyId } });
    const totalEmployees = await User.count({ where: { companyId, role: 'EMPLOYEE' } });
    
    res.json({
      totalTickets,
      openTickets,
      closedTickets,
      resolvedTickets,
      totalUsers,
      totalEmployees
    });
  } catch (error) {
    console.error('[getStats]', error);
    res.status(500).json({ message: 'حدث خطأ داخلي.' });
  }
};
