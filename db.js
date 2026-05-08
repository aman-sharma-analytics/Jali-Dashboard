import mysql  from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const pool = mysql.createPool({
  host:                  process.env.DB_HOST     || 'localhost',
  port:                  Number(process.env.DB_PORT) || 3306,
  user:                  process.env.DB_USER     || 'root',
  password:              process.env.DB_PASSWORD || '',
  database:              process.env.DB_NAME     || 'webinar_insights',
  connectionLimit:       10,
  waitForConnections:    true,
  queueLimit:            0,
  charset:               'utf8mb4',
  // Use +00:00 so DATE columns are not shifted by timezone conversion
  timezone:              '+00:00',
  enableKeepAlive:       true,
  keepAliveInitialDelay: 10000,
});

export async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('SELECT 1');
    console.log(`✅  MySQL pool ready — ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME}`);
  } catch (err) {
    console.error('❌  MySQL connection FAILED:', err.message);
    console.error('    → Is MySQL running? Is DB_PASSWORD correct in backend/.env?');
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

export default pool;