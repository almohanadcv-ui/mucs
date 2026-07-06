import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('HARDWARE', 'PRINTERS', 'INTERNET', 'NETWORK', 'SOFTWARE', 'EMAIL', 'BILLING', 'OTHER'),
    allowNull: false,
  },
  softwareName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'),
    defaultValue: 'OPEN',
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
  },
  billingStatus: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'PENDING',
  },
  billingItems: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // Soft delete audit fields
  deletedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  deletedByName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deletedByRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deletionReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  paranoid: true, // adds deletedAt + makes destroy() a soft-delete
  indexes: [
    { fields: ['companyId'] },
    { fields: ['employeeId'] },
    { fields: ['assignedTo'] },
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['companyId', 'category'] },
    { fields: ['companyId', 'status'] },
    { fields: ['createdAt'] },
    { fields: ['deletedAt'] },
  ],
});

export default Ticket;
