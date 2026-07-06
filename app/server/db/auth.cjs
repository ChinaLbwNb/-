const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./database.cjs');

const JWT_SECRET = process.env.JWT_SECRET || 'ai-tool-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const MAX_LOGIN_FAILS = 5;
const LOCK_DURATION_MINUTES = 10;

function validatePassword(password) {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少8位' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含数字' };
  }
  return { valid: true };
}

function validateUsername(username) {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: '用户名长度需在3-20位之间' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: '用户名只能包含字母、数字和下划线' };
  }
  return { valid: true };
}

function validateEmail(email) {
  if (!email) return { valid: true };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: '邮箱格式不正确' };
  }
  return { valid: true };
}

function isUserLocked(user) {
  if (!user.locked_until) return false;
  const lockedUntil = new Date(user.locked_until);
  return lockedUntil > new Date();
}

function register(username, password, email) {
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
      VALUES (?, ?, ?, ?, 'user', 'active')
    `).run(userId, username, passwordHash, email || null);

    return { success: true, userId };
  } catch (error) {
    return { success: false, message: '注册失败，请稍后重试' };
  }
}

function login(username, password, ip, userAgent) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) {
    logLoginAttempt(null, username, ip, userAgent, false);
    return { success: false, message: '用户名或密码错误' };
  }

  if (user.status === 'locked') {
    logLoginAttempt(user.id, username, ip, userAgent, false);
    return { success: false, message: '账号已被锁定，请联系管理员' };
  }

  if (user.status === 'deleted') {
    logLoginAttempt(user.id, username, ip, userAgent, false);
    return { success: false, message: '账号已注销' };
  }

  if (isUserLocked(user)) {
    logLoginAttempt(user.id, username, ip, userAgent, false);
    const lockedUntil = new Date(user.locked_until);
    return { 
      success: false, 
      message: `账号已锁定，请${Math.ceil((lockedUntil - new Date()) / 60000)}分钟后重试` 
    };
  }

  const passwordMatch = bcrypt.compareSync(password, user.password_hash);

  if (!passwordMatch) {
    const newFailCount = user.login_fail_count + 1;
    
    if (newFailCount >= MAX_LOGIN_FAILS) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      db.prepare(`
        UPDATE users SET login_fail_count = ?, locked_until = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newFailCount, lockedUntil.toISOString(), user.id);
      
      logLoginAttempt(user.id, username, ip, userAgent, false);
      return { success: false, message: `密码错误次数过多，账号已锁定${LOCK_DURATION_MINUTES}分钟` };
    }

    db.prepare(`
      UPDATE users SET login_fail_count = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newFailCount, user.id);

    logLoginAttempt(user.id, username, ip, userAgent, false);
    return { 
      success: false, 
      message: `用户名或密码错误，还剩${MAX_LOGIN_FAILS - newFailCount}次机会` 
    };
  }

  db.prepare(`
    UPDATE users SET login_fail_count = 0, locked_until = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(user.id);

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, user.id, token, expiresAt.toISOString());

  logLoginAttempt(user.id, username, ip, userAgent, true);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status
    }
  };
}

function logLoginAttempt(userId, username, ip, userAgent, success) {
  db.prepare(`
    INSERT INTO login_logs (user_id, username, ip, user_agent, success)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, username, ip, userAgent, success ? 1 : 0);
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[verifyToken] JWT解码成功, userId:', decoded.userId);
    
    const session = db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").get(token);
    console.log('[verifyToken] Session查询结果:', session ? '找到' : '未找到');
    
    if (!session) {
      // 检查是否有过期session
      const expiredSession = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
      console.log('[verifyToken] 过期session:', expiredSession ? '存在' : '不存在');
      if (expiredSession) {
        console.log('[verifyToken] 过期时间:', expiredSession.expires_at);
        console.log('[verifyToken] 当前时间:', new Date().toISOString());
      }
      return { valid: false, message: '会话已过期' };
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    console.log('[verifyToken] 用户查询结果:', user ? '找到' : '未找到');
    if (!user || user.status !== 'active') {
      return { valid: false, message: '用户状态异常' };
    }

    return { 
      valid: true, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        status: user.status
      }
    };
  } catch (error) {
    console.log('[verifyToken] JWT验证失败:', error.message);
    return { valid: false, message: '无效的令牌' };
  }
}

function logout(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return { success: true };
}

function changePassword(userId, oldPassword, newPassword) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  const passwordMatch = bcrypt.compareSync(oldPassword, user.password_hash);
  if (!passwordMatch) {
    return { success: false, message: '原密码错误' };
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { success: false, message: passwordValidation.message };
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(passwordHash, userId);

  return { success: true };
}

function updateEmail(userId, email) {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, message: emailValidation.message };
  }

  db.prepare(`
    UPDATE users SET email = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(email, userId);

  return { success: true };
}

function updateAvatar(userId, avatar) {
  db.prepare(`
    UPDATE users SET avatar = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(avatar, userId);

  return { success: true };
}

function getUserById(userId) {
  const user = db.prepare(`
    SELECT id, username, email, avatar, role, status, created_at, updated_at
    FROM users WHERE id = ?
  `).get(userId);
  return user;
}

function getLoginLogs(userId, limit = 50) {
  return db.prepare(`
    SELECT * FROM login_logs 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `).all(userId, limit);
}

module.exports = {
  validatePassword,
  validateUsername,
  validateEmail,
  register,
  login,
  logout,
  verifyToken,
  changePassword,
  updateEmail,
  updateAvatar,
  getUserById,
  getLoginLogs,
  JWT_SECRET
};
