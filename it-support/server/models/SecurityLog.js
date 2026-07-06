/**
 * SecurityLog — persistent activity log for login/auth events.
 * Lets admins audit who logged in (or tried), when, from where, etc.
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SecurityLog = sequelize.define('SecurityLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  userName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  eventType: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  ip: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  isp: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['eventType'] },
    { fields: ['userId'] },
    { fields: ['email'] },
    { fields: ['createdAt'] },
    { fields: ['companyId', 'createdAt'] },
  ],
});

export default SecurityLog;
