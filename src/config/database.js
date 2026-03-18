const { Sequelize } = require('sequelize');
require('dotenv').config();

let dbConfig;

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  dbConfig = {
    database: url.pathname.slice(1),
    username: url.username,
    password: url.password,
    host: url.hostname,
    port: url.port || 3306,
  };
} else {
  dbConfig = {
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'railway',
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
  };
}

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      connectTimeout: 60000,
      ...(process.env.DB_SSL === 'true' && {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      })
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  }
};

module.exports = { sequelize, connectDB };
