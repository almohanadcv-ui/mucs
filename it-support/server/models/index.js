import sequelize from '../config/database.js';
import Company from './Company.js';
import User from './User.js';
import Ticket from './Ticket.js';
import Reply from './Reply.js';
import Attachment from './Attachment.js';
import Notification from './Notification.js';
import Asset from './Asset.js';
import AssetCategory from './AssetCategory.js';
import AssetAssignment from './AssetAssignment.js';
import MaintenanceLog from './MaintenanceLog.js';
import SecurityLog from './SecurityLog.js';

// Company & User
Company.hasMany(User, { foreignKey: 'companyId', onDelete: 'CASCADE' });
User.belongsTo(Company, { foreignKey: 'companyId' });

// Company & Ticket
Company.hasMany(Ticket, { foreignKey: 'companyId', onDelete: 'CASCADE' });
Ticket.belongsTo(Company, { foreignKey: 'companyId' });

// User & Ticket (Employee created)
User.hasMany(Ticket, { foreignKey: 'employeeId', as: 'CreatedTickets' });
Ticket.belongsTo(User, { foreignKey: 'employeeId', as: 'Creator' });

// User & Ticket (Assigned to)
User.hasMany(Ticket, { foreignKey: 'assignedTo', as: 'AssignedTickets' });
Ticket.belongsTo(User, { foreignKey: 'assignedTo', as: 'Assignee' });

// Ticket & Reply
Ticket.hasMany(Reply, { foreignKey: 'ticketId', onDelete: 'CASCADE' });
Reply.belongsTo(Ticket, { foreignKey: 'ticketId' });

// User & Reply
User.hasMany(Reply, { foreignKey: 'userId' });
Reply.belongsTo(User, { foreignKey: 'userId' });

// Ticket & Attachment
Ticket.hasMany(Attachment, { foreignKey: 'ticketId', onDelete: 'CASCADE' });
Attachment.belongsTo(Ticket, { foreignKey: 'ticketId' });

// Reply & Attachment
Reply.hasMany(Attachment, { foreignKey: 'replyId', onDelete: 'CASCADE' });
Attachment.belongsTo(Reply, { foreignKey: 'replyId' });

// User & Notification
User.hasMany(Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// ───── Asset relationships ──────────────────────────────────────
// Company & Asset
Company.hasMany(Asset, { foreignKey: 'companyId', onDelete: 'CASCADE' });
Asset.belongsTo(Company, { foreignKey: 'companyId' });

// Company & AssetCategory
Company.hasMany(AssetCategory, { foreignKey: 'companyId', onDelete: 'CASCADE' });
AssetCategory.belongsTo(Company, { foreignKey: 'companyId' });

// AssetCategory & Asset
AssetCategory.hasMany(Asset, { foreignKey: 'categoryId' });
Asset.belongsTo(AssetCategory, { foreignKey: 'categoryId', as: 'Category' });

// User holds Asset (current holder)
User.hasMany(Asset, { foreignKey: 'currentUserId', as: 'AssignedAssets' });
Asset.belongsTo(User, { foreignKey: 'currentUserId', as: 'CurrentUser' });

// Asset & AssetAssignment (history)
Asset.hasMany(AssetAssignment, { foreignKey: 'assetId', onDelete: 'CASCADE' });
AssetAssignment.belongsTo(Asset, { foreignKey: 'assetId' });

// User & AssetAssignment (who held it)
User.hasMany(AssetAssignment, { foreignKey: 'userId', as: 'AssetHistory' });
AssetAssignment.belongsTo(User, { foreignKey: 'userId', as: 'Holder' });

// User & AssetAssignment (who assigned it — IT person)
User.hasMany(AssetAssignment, { foreignKey: 'assignedBy', as: 'AssetAssignmentsMade' });
AssetAssignment.belongsTo(User, { foreignKey: 'assignedBy', as: 'AssignedByUser' });

// Asset & MaintenanceLog
Asset.hasMany(MaintenanceLog, { foreignKey: 'assetId', onDelete: 'CASCADE' });
MaintenanceLog.belongsTo(Asset, { foreignKey: 'assetId' });

// Ticket & MaintenanceLog (optional link)
Ticket.hasMany(MaintenanceLog, { foreignKey: 'ticketId' });
MaintenanceLog.belongsTo(Ticket, { foreignKey: 'ticketId' });

// User & MaintenanceLog (technician)
User.hasMany(MaintenanceLog, { foreignKey: 'performedBy', as: 'MaintenancesPerformed' });
MaintenanceLog.belongsTo(User, { foreignKey: 'performedBy', as: 'Technician' });

// SecurityLog has no associations — standalone audit table
// (intentionally not linked to User so audit survives user deletion)

export {
  sequelize,
  Company,
  User,
  Ticket,
  Reply,
  Attachment,
  Notification,
  Asset,
  AssetCategory,
  AssetAssignment,
  MaintenanceLog,
  SecurityLog,
};
