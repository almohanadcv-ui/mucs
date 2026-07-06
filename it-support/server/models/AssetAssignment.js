/**
 * AssetAssignment — history of who held each asset (audit log).
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AssetAssignment = sequelize.define('AssetAssignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assetId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  assignedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  assignedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  returnedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  conditionOnAssignment: {
    type: DataTypes.ENUM('NEW', 'GOOD', 'FAIR', 'POOR', 'BROKEN'),
    defaultValue: 'GOOD',
  },
  conditionOnReturn: {
    type: DataTypes.ENUM('NEW', 'GOOD', 'FAIR', 'POOR', 'BROKEN'),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  signature: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['assetId'] },
    { fields: ['userId'] },
    { fields: ['returnedAt'] },
  ],
});

export default AssetAssignment;
