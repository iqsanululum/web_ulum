import mysql from 'mysql2/promise';

// Singleton connection pool — reused across API calls in the same process
let pool;

export function getPool() {
  if (!pool) {
    const url = process.env.MYSQL_URL;

    if (url) {
      // Use full connection string when available (Railway injects this)
      console.log('[db] Using MYSQL_URL connection string');
      pool = mysql.createPool({
        uri: url,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
      });
    } else {
      // Fallback to individual vars (local dev)
      console.log('[db] ENV CHECK:', {
        MYSQLHOST:     process.env.MYSQLHOST     || '(not set)',
        MYSQLPORT:     process.env.MYSQLPORT     || '(not set)',
        MYSQLUSER:     process.env.MYSQLUSER     || '(not set)',
        MYSQLDATABASE: process.env.MYSQLDATABASE || '(not set)',
      });
      pool = mysql.createPool({
        host:     process.env.MYSQLHOST     || process.env.MYSQL_HOST     || 'localhost',
        port:     parseInt(process.env.MYSQLPORT     || process.env.MYSQL_PORT     || '3306'),
        user:     process.env.MYSQLUSER     || process.env.MYSQL_USER     || 'root',
        password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
      });
    }
  }
  return pool;
}
