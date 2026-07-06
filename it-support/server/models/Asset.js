/**
 * Asset — represents a single physical IT asset (laptop, printer, monitor, etc.)
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Asset = sequelize.define('Asset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  assetTag: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  brand: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  model: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  serialNumber: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  purchaseDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  vendor: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  invoiceNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  warrantyExpiry: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(
      'AVAILABLE',
      'ASSIGNED',
      'IN_REPAIR',
      'RETIRED',
      'LOST'
    ),
    defaultValue: 'AVAILABLE',
  },
  condition: {
    type: DataTypes.ENUM('NEW', 'GOOD', 'FAIR', 'POOR', 'BROKEN'),
    defaultValue: 'GOOD',
  },
  currentUserId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  specifications: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  odooNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  deviceColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  invoiceFile: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  assignmentDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // Soft-delete audit
  deletedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  deletedByName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deletionReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['companyId'] },
    { fields: ['assetTag'], unique: true },
    { fields: ['currentUserId'] },
    { fields: ['categoryId'] },
    { fields: ['status'] },
    { fields: ['companyId', 'status'] },
    { fields: ['warrantyExpiry'] },
    { fields: ['deletedAt'] },
  ],
});

export default Asset;
