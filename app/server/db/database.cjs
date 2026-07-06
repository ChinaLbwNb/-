const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'users.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      balance INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      login_fail_count INTEGER DEFAULT 0,
      locked_until TEXT
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      success INTEGER,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      is_system_prompt INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      file_path TEXT,
      file_size INTEGER,
      mime_type TEXT,
      content TEXT,
      parsed_content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pricing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recharge_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT,
      duration INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      payment_method TEXT,
      status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      payment_url TEXT,
      paid_at TEXT,
      notify_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES pricing_plans(id)
    );

    CREATE TABLE IF NOT EXISTS interview_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_position TEXT,
      start_time TEXT DEFAULT (datetime('now')),
      end_time TEXT,
      duration_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_prompts_system ON prompts(is_system_prompt);
    CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
    CREATE INDEX IF NOT EXISTS idx_recharge_user ON recharge_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_interview_user ON interview_sessions(user_id);
  `);

  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');
    const adminId = uuidv4();
    const defaultPassword = 'Admin@123456';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, email, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin', passwordHash, 'admin@system.local', 'admin', 'active');
    
    console.log('[DB] 默认管理员账号已创建: admin / Admin@123456');
  }
}

module.exports = { db, initDatabase };
