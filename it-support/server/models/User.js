import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

const User = sequelize.define('User', {
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
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('EMPLOYEE', 'IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'),
    defaultValue: 'EMPLOYEE',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  profileImage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  temporaryCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  requiresPasswordChange: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // ⚠️ SECURITY NOTE:
  // plainPassword stores the password in CLEARTEXT so IT/Admin can read it
  // from the dashboard. This is requested for internal helpdesk use.
  // The bcrypt hash in `password` remains the source of truth for auth.
  plainPassword: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Holds the JWT of the user's currently active session.
  // Set on login; checked by auth middleware. Logging in from a 2nd device
  // overwrites it, instantly invalidating the 1st device's session.
  currentSessionToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // Extra granular permissions granted on TOP of the user's role.
  // Stored as JSON array of permission strings (see utils/permissions.js).
  permissions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.plainPassword = user.password;
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        user.plainPassword = user.password;
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

export default User;
