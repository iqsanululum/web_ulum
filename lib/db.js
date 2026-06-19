import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    const url = process.env.MYSQL_URL;

    let config;

    if (url) {
      // Parse mysql://user:pass@host:port/db manually for reliability
      try {
        const parsed = new URL(url);
        config = {
          host:     parsed.hostname,
          port:     parseInt(parsed.port || '3306'),
          user:     decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
          database: parsed.pathname.replace(/^\//, ''),
          waitForConnections: true,
          connectionLimit: 10,
          connectTimeout: 10000,
        };
        console.log('[db] Parsed MYSQL_URL → host:', config.host, 'port:', config.port, 'db:', config.database);
      } catch (e) {
        console.error('[db] Failed to parse MYSQL_URL:', e.message);
      }
    }

    if (!config) {
      // Fallback to individual env vars
      config = {
        host:     process.env.MYSQLHOST     || process.env.MYSQL_HOST     || 'localhost',
        port:     parseInt(process.env.MYSQLPORT     || process.env.MYSQL_PORT     || '3306'),
        user:     process.env.MYSQLUSER     || process.env.MYSQL_USER     || 'root',
        password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
      };
      console.log('[db] Using individual env vars → host:', config.host, 'port:', config.port, 'db:', config.database);
    }

    pool = mysql.createPool(config);
  }
  return pool;
}
