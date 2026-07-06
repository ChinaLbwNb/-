const { v4: uuidv4 } = require('uuid');

function createInterviewRoutes(db) {
  const router = require('express').Router();

  router.post('/start', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: '用户不存在' });
      }

      if (user.balance <= 0) {
        return res.status(403).json({ ok: false, error: '余额不足，请先充值' });
      }

      const sessionId = uuidv4();
      const { job_position } = req.body;

      db.prepare(`
        INSERT INTO interview_sessions (id, user_id, job_position, start_time)
        VALUES (?, ?, ?, datetime('now'))
      `).run(sessionId, userId, job_position || '');

      res.json({ 
        ok: true, 
        session_id: sessionId,
        balance: user.balance 
      });
    } catch (e) {
      console.error('[Interview] 开始面试失败:', e);
      res.status(500).json({ ok: false, error: '开始面试失败' });
    }
  });

  router.post('/end', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const { session_id } = req.body;
      if (!session_id) {
        return res.status(400).json({ ok: false, error: '会话ID不能为空' });
      }

      const session = db.prepare(`
        SELECT * FROM interview_sessions 
        WHERE id = ? AND user_id = ? AND end_time IS NULL
      `).get(session_id, userId);

      if (!session) {
        return res.status(404).json({ ok: false, error: '会话不存在或已结束' });
      }

      const startTime = new Date(session.start_time);
      const endTime = new Date();
      const durationUsed = Math.floor((endTime - startTime) / 1000);

      db.prepare('BEGIN TRANSACTION').run();

      try {
        db.prepare(`
          UPDATE interview_sessions 
          SET end_time = datetime('now'), duration_used = ?
          WHERE id = ?
        `).run(durationUsed, session_id);

        db.prepare(`
          UPDATE users 
          SET balance = balance - ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(durationUsed, userId);

        db.prepare('COMMIT').run();

        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
        res.json({ 
          ok: true, 
          duration_used: durationUsed,
          balance: user.balance 
        });
      } catch (e) {
        db.prepare('ROLLBACK').run();
        throw e;
      }
    } catch (e) {
      console.error('[Interview] 结束面试失败:', e);
      res.status(500).json({ ok: false, error: '结束面试失败' });
    }
  });

  router.get('/current', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const session = db.prepare(`
        SELECT * FROM interview_sessions 
        WHERE user_id = ? AND end_time IS NULL 
        ORDER BY start_time DESC 
        LIMIT 1
      `).get(userId);

      if (!session) {
        return res.json({ ok: true, session: null });
      }

      const startTime = new Date(session.start_time);
      const currentTime = new Date();
      const currentDuration = Math.floor((currentTime - startTime) / 1000);

      res.json({ 
        ok: true, 
        session: {
          ...session,
          current_duration: currentDuration
        }
      });
    } catch (e) {
      console.error('[Interview] 获取当前会话失败:', e);
      res.status(500).json({ ok: false, error: '获取当前会话失败' });
    }
  });

  router.get('/history', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const sessions = db.prepare(`
        SELECT * FROM interview_sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `).all(userId, parseInt(limit), offset);

      const total = db.prepare(`
        SELECT COUNT(*) as count 
        FROM interview_sessions 
        WHERE user_id = ?
      `).get(userId).count;

      res.json({ 
        ok: true, 
        sessions, 
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (e) {
      console.error('[Interview] 获取历史记录失败:', e);
      res.status(500).json({ ok: false, error: '获取历史记录失败' });
    }
  });

  return router;
}

module.exports = { createInterviewRoutes };