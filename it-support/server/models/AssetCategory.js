/**
 * AssetCategory — categories like Laptop, Printer, Monitor, Router, Phone, Server.
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AssetCategory = sequelize.define('AssetCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  nameAr: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['companyId'] },
    { fields: ['companyId', 'name'] },
  ],
});

export default AssetCategory;
