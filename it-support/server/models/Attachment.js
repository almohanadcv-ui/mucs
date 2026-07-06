import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Attachment = sequelize.define('Attachment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticketId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  replyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileType: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  timestamps: true,
});

export default Attachment;
