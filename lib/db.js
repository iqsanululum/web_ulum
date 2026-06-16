import mysql from 'mysql2/promise';

// Singleton connection pool — reused across API calls in the same process
let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:     process.env.MYSQL_HOST     || 'localhost',
      port:     parseInt(process.env.MYSQL_PORT || '3306'),
      user:     process.env.MYSQL_USER     || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'quake_dashboard',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}
