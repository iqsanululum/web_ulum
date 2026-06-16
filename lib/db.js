import mysql from 'mysql2/promise';

// Singleton connection pool — reused across API calls in the same process
let pool;

export function getPool() {
  if (!pool) {
    // Railway MySQL plugin injects: MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
    // Fallback to MYSQL_* (local .env.local) then hardcoded defaults
    pool = mysql.createPool({
      host:     process.env.MYSQLHOST     || process.env.MYSQL_HOST     || 'localhost',
      port:     parseInt(process.env.MYSQLPORT     || process.env.MYSQL_PORT     || '3306'),
      user:     process.env.MYSQLUSER     || process.env.MYSQL_USER     || 'root',
      password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 10000, // fail fast in 10s instead of hanging 50s+
    });
  }
  return pool;
}
