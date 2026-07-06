const { v4: uuidv4 } = require('uuid');

function createRechargeRoutes(db) {
  const router = require('express').Router();

  router.get('/plans', (req, res) => {
    try {
      const plans = db.prepare(`
        SELECT * FROM pricing_plans 
        WHERE is_active = 1 
        ORDER BY sort_order ASC, price ASC
      `).all();
      res.json({ ok: true, plans });
    } catch (e) {
      console.error('[Recharge] 获取套餐失败:', e);
      res.status(500).json({ ok: false, error: '获取套餐失败' });
    }
  });

  router.get('/balance', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      res.json({ ok: true, balance: user?.balance || 0 });
    } catch (e) {
      console.error('[Recharge] 获取余额失败:', e);
      res.status(500).json({ ok: false, error: '获取余额失败' });
    }
  });

  router.get('/records', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const records = db.prepare(`
        SELECT r.*, p.name as plan_name, p.duration as plan_duration 
        FROM recharge_records r 
        LEFT JOIN pricing_plans p ON r.plan_id = p.id 
        WHERE r.user_id = ? 
        ORDER BY r.created_at DESC 
        LIMIT 50
      `).all(userId);

      res.json({ ok: true, records });
    } catch (e) {
      console.error('[Recharge] 获取充值记录失败:', e);
      res.status(500).json({ ok: false, error: '获取充值记录失败' });
    }
  });

  router.post('/create', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const { plan_id } = req.body;
      if (!plan_id) {
        return res.status(400).json({ ok: false, error: '请选择套餐' });
      }

      const plan = db.prepare('SELECT * FROM pricing_plans WHERE id = ? AND is_active = 1').get(plan_id);
      if (!plan) {
        return res.status(400).json({ ok: false, error: '套餐不存在' });
      }

      const recordId = uuidv4();
      db.prepare(`
        INSERT INTO recharge_records (id, user_id, plan_id, duration, amount, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(recordId, userId, plan_id, plan.duration, plan.price, 'pending');

      res.json({ 
        ok: true, 
        record_id: recordId,
        plan: {
          id: plan.id,
          name: plan.name,
          duration: plan.duration,
          price: plan.price
        }
      });
    } catch (e) {
      console.error('[Recharge] 创建充值订单失败:', e);
      res.status(500).json({ ok: false, error: '创建充值订单失败' });
    }
  });

  router.post('/confirm', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const { record_id, transaction_id } = req.body;
      if (!record_id) {
        return res.status(400).json({ ok: false, error: '订单ID不能为空' });
      }

      const record = db.prepare('SELECT * FROM recharge_records WHERE id = ? AND user_id = ?').get(record_id, userId);
      if (!record) {
        return res.status(404).json({ ok: false, error: '订单不存在' });
      }

      if (record.status !== 'pending') {
        return res.status(400).json({ ok: false, error: '订单状态异常' });
      }

      db.prepare('BEGIN TRANSACTION').run();

      try {
        db.prepare(`
          UPDATE recharge_records 
          SET status = 'completed', transaction_id = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(transaction_id || '', record_id);

        db.prepare(`
          UPDATE users 
          SET balance = balance + ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(record.duration, userId);

        db.prepare('COMMIT').run();

        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
        res.json({ ok: true, balance: user.balance });
      } catch (e) {
        db.prepare('ROLLBACK').run();
        throw e;
      }
    } catch (e) {
      console.error('[Recharge] 确认充值失败:', e);
      res.status(500).json({ ok: false, error: '确认充值失败' });
    }
  });

  return router;
}

module.exports = { createRechargeRoutes };