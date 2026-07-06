import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Sized for ~50+ concurrent users on a single VPS.
// Adjust DB_POOL_MAX in .env if your DB server has fewer max_connections.
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '20', 10);
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2', 10);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development' ? false : false,
    pool: {
      max: POOL_MAX,
      min: POOL_MIN,
      acquire: 30000,
      idle: 10000,
      evict: 1000,
    },
    dialectOptions: {
      charset: 'utf8mb4',
    },
    benchmark: false,
  }
);

export default sequelize;
