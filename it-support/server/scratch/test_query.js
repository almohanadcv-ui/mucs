import sequelize from '../config/database.js';
import { User, Company, Ticket } from '../models/index.js';

const test = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB successfully');
    
    const companies = await Company.findAll();
    console.log('COMPANIES:', companies.map(c => ({ id: c.id, subdomain: c.subdomain, name: c.name })));

    const users = await User.findAll();
    console.log('USERS:', users.map(u => ({ id: u.id, email: u.email, role: u.role, companyId: u.companyId })));

    const tickets = await Ticket.findAll();
    console.log('TICKETS:', tickets.map(t => ({ id: t.id, title: t.title, companyId: t.companyId, employeeId: t.employeeId, category: t.category })));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    process.exit();
  }
};

test();
