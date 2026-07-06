const { db } = require('./database.cjs');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { validatePassword, validateUsername, validateEmail } = require('./auth.cjs');

function getAllUsers(page = 1, pageSize = 20, search = '') {
  const offset = (page - 1) * pageSize;
  let whereClause = '1=1';
  const params = [];

  if (search) {
    whereClause += ' AND (username LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`).get(...params);
  const total = countResult.total;

  params.push(pageSize, offset);
  const users = db.prepare(`
    SELECT id, username, email, avatar, role, status, created_at, updated_at, login_fail_count, locked_until
    FROM users 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  return {
    users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

function getUserById(userId) {
  return db.prepare(`
    SELECT id, username, email, avatar, role, status, created_at, updated_at
    FROM users WHERE id = ?
  `).get(userId);
}

function createUser(userData) {
  const { username, password, email, role = 'user' } = userData;

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return { success: false, message: usernameValidation.message };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, message: passwordValidation.message };
  }

  if (email) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return { success: false, message: emailValidation.message };
    }
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return { success: false, message: '用户名已存在' };
  }

  const userId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    db.prepare(`
      INSERT INTO users (id, username, password_hash, email, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(userId, username, passwordHash, email || null, role);

    return { success: true, userId };
  } catch (error) {
    return { success: false, message: '创建用户失败' };
  }
}

function updateUser(userId, userData) {
  const { email, role, status } = userData;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  if (email !== undefined) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return { success: false, message: emailValidation.message };
    }
  }

  const updates = [];
  const params = [];

  if (email !== undefined) {
    updates.push('email = ?');
    params.push(email);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    params.push(role);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length === 0) {
    return { success: false, message: '没有需要更新的字段' };
  }

  updates.push("updated_at = datetime('now')");
  params.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  return { success: true };
}

function resetUserPassword(userId, newPassword) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { success: false, message: passwordValidation.message };
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, login_fail_count = 0, locked_until = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(passwordHash, userId);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

  return { success: true };
}

function deleteUser(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
    if (adminCount.count <= 1) {
      return { success: false, message: '不能删除最后一个管理员账号' };
    }
  }

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  return { success: true };
}

function lockUser(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  if (user.role === 'admin') {
    return { success: false, message: '不能锁定管理员账号' };
  }

  db.prepare(`
    UPDATE users SET status = 'locked', updated_at = datetime('now')
    WHERE id = ?
  `).run(userId);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

  return { success: true };
}

function unlockUser(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  db.prepare(`
    UPDATE users SET status = 'active', login_fail_count = 0, locked_until = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(userId);

  return { success: true };
}

function getLoginLogsAdmin(page = 1, pageSize = 50, userId = null) {
  const offset = (page - 1) * pageSize;
  let whereClause = '1=1';
  const params = [];

  if (userId) {
    whereClause += ' AND user_id = ?';
    params.push(userId);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM login_logs WHERE ${whereClause}`).get(...params);
  const total = countResult.total;

  params.push(pageSize, offset);
  const logs = db.prepare(`
    SELECT * FROM login_logs 
    WHERE ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  return {
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

function getStats() {
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  const activeUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count;
  const lockedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'locked'").get().count;
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
  const todayLogins = db.prepare(`
    SELECT COUNT(*) as count FROM login_logs 
    WHERE date(timestamp) = date('now') AND success = 1
  `).get().count;

  return {
    totalUsers,
    activeUsers,
    lockedUsers,
    adminCount,
    todayLogins
  };
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  lockUser,
  unlockUser,
  getLoginLogsAdmin,
  getStats
};
