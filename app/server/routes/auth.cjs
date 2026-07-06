const express = require('express');
const cookieParser = require('cookie-parser');
const auth = require('../db/auth.cjs');
const admin = require('../db/admin.cjs');

const router = express.Router();
router.use(cookieParser());

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

function authMiddleware(req, res, next) {
  console.log('[Auth] Cookies:', req.cookies);
  console.log('[Auth] Authorization header:', req.headers.authorization);
  
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  
  console.log('[Auth] Token:', token ? '存在' : '不存在');
  
  if (!token) {
    return res.status(401).json({ ok: false, message: '未登录' });
  }

  const result = auth.verifyToken(token);
  console.log('[Auth] Token验证结果:', result.valid ? '有效' : '无效', result.message || '');
  
  if (!result.valid) {
    return res.status(401).json({ ok: false, message: result.message });
  }

  req.user = result.user;
  next();
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: '需要管理员权限' });
  }
  next();
}

router.post('/register', (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: '用户名和密码不能为空' });
  }

  const result = auth.register(username, password, email);
  if (result.success) {
    res.json({ ok: true, message: '注册成功', userId: result.userId });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: '用户名和密码不能为空' });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const result = auth.login(username, password, ip, userAgent);

  if (result.success) {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: false, // 开发环境不使用 secure
      sameSite: 'lax',
      path: '/',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    };

    res.cookie('token', result.token, cookieOptions);
    res.json({ ok: true, user: result.user, token: result.token });
  } else {
    res.status(401).json({ ok: false, message: result.message });
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    auth.logout(token);
  }
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true, message: '已退出登录' });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = auth.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ ok: false, message: '用户不存在' });
  }
  res.json({ ok: true, user });
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ ok: false, message: '请填写完整信息' });
  }

  const result = auth.changePassword(req.user.id, oldPassword, newPassword);
  if (result.success) {
    res.json({ ok: true, message: '密码修改成功' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/update-email', authMiddleware, (req, res) => {
  const { email } = req.body;

  const result = auth.updateEmail(req.user.id, email);
  if (result.success) {
    res.json({ ok: true, message: '邮箱更新成功' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/update-avatar', authMiddleware, (req, res) => {
  const { avatar } = req.body;

  if (!avatar) {
    return res.status(400).json({ ok: false, message: '头像数据不能为空' });
  }

  const result = auth.updateAvatar(req.user.id, avatar);
  if (result.success) {
    res.json({ ok: true, message: '头像更新成功' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.get('/login-logs', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = auth.getLoginLogs(req.user.id, limit);
  res.json({ ok: true, logs });
});

router.get('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const search = req.query.search || '';

  const result = admin.getAllUsers(page, pageSize, search);
  res.json({ ok: true, ...result });
});

router.get('/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const user = admin.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, message: '用户不存在' });
  }
  res.json({ ok: true, user });
});

router.post('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const result = admin.createUser(req.body);
  if (result.success) {
    res.json({ ok: true, message: '用户创建成功', userId: result.userId });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.put('/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const result = admin.updateUser(req.params.id, req.body);
  if (result.success) {
    res.json({ ok: true, message: '用户更新成功' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/admin/users/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const { newPassword } = req.body;
  
  if (!newPassword) {
    return res.status(400).json({ ok: false, message: '新密码不能为空' });
  }

  const result = admin.resetUserPassword(req.params.id, newPassword);
  if (result.success) {
    res.json({ ok: true, message: '密码重置成功' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.delete('/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const result = admin.deleteUser(req.params.id);
  if (result.success) {
    res.json({ ok: true, message: '用户已删除' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/admin/users/:id/lock', authMiddleware, adminMiddleware, (req, res) => {
  const result = admin.lockUser(req.params.id);
  if (result.success) {
    res.json({ ok: true, message: '用户已锁定' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/admin/users/:id/unlock', authMiddleware, adminMiddleware, (req, res) => {
  const result = admin.unlockUser(req.params.id);
  if (result.success) {
    res.json({ ok: true, message: '用户已解锁' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.get('/admin/login-logs', authMiddleware, adminMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const userId = req.query.userId || null;

  const result = admin.getLoginLogsAdmin(page, pageSize, userId);
  res.json({ ok: true, ...result });
});

router.get('/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const stats = admin.getStats();
  res.json({ ok: true, stats });
});

const prompts = require('../db/prompts.cjs');

router.get('/admin/prompts', authMiddleware, adminMiddleware, (req, res) => {
  const allPrompts = prompts.getAllPrompts();
  res.json({ ok: true, prompts: allPrompts });
});

router.get('/admin/prompts/:id', authMiddleware, adminMiddleware, (req, res) => {
  const prompt = prompts.getPromptById(req.params.id);
  if (!prompt) {
    return res.status(404).json({ ok: false, message: 'Prompt 不存在' });
  }
  res.json({ ok: true, prompt });
});

router.post('/admin/prompts', authMiddleware, adminMiddleware, (req, res) => {
  const { name, content, description } = req.body;
  const result = prompts.createPrompt({
    name,
    content,
    description,
    createdBy: req.user.id,
  });
  if (result.success) {
    res.json({ ok: true, message: 'Prompt 创建成功', promptId: result.promptId });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.put('/admin/prompts/:id', authMiddleware, adminMiddleware, (req, res) => {
  const result = prompts.updatePrompt(req.params.id, req.body);
  if (result.success) {
    res.json({ ok: true, message: 'Prompt 更新成功' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.delete('/admin/prompts/:id', authMiddleware, adminMiddleware, (req, res) => {
  const result = prompts.deletePrompt(req.params.id);
  if (result.success) {
    res.json({ ok: true, message: 'Prompt 已删除' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.post('/admin/prompts/:id/set-system', authMiddleware, adminMiddleware, (req, res) => {
  const result = prompts.setSystemPrompt(req.params.id);
  if (result.success) {
    res.json({ ok: true, message: '已设置为系统 Prompt' });
  } else {
    res.status(400).json({ ok: false, message: result.message });
  }
});

router.get('/system-prompt', (req, res) => {
  const systemPrompt = prompts.getSystemPrompt();
  if (systemPrompt) {
    res.json({ ok: true, prompt: systemPrompt });
  } else {
    res.json({ ok: false, message: '未设置系统 Prompt' });
  }
});

module.exports = { router, authMiddleware, adminMiddleware };
