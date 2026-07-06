/**
 * MaintenanceLog — every repair/maintenance event on an asset.
 * Optionally linked to a Ticket from the support system.
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MaintenanceLog = sequelize.define('MaintenanceLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assetId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  ticketId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  performedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  issue: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  partsReplaced: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  performedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['assetId'] },
    { fields: ['ticketId'] },
    { fields: ['performedAt'] },
  ],
});

export default MaintenanceLog;
