const { v4: uuidv4 } = require('uuid');

function createAdminRechargeRoutes(db) {
  const router = require('express').Router();

  router.get('/plans', (req, res) => {
    try {
      const plans = db.prepare(`
        SELECT * FROM pricing_plans 
        ORDER BY sort_order ASC, created_at DESC
      `).all();
      res.json({ ok: true, plans });
    } catch (e) {
      console.error('[Admin] 获取套餐列表失败:', e);
      res.status(500).json({ ok: false, error: '获取套餐列表失败' });
    }
  });

  router.post('/plans', (req, res) => {
    try {
      const { name, duration, price, description, sort_order } = req.body;

      if (!name || !duration || !price) {
        return res.status(400).json({ ok: false, error: '请填写完整信息' });
      }

      if (duration <= 0 || price <= 0) {
        return res.status(400).json({ ok: false, error: '时长和价格必须大于0' });
      }

      const planId = uuidv4();
      db.prepare(`
        INSERT INTO pricing_plans (id, name, duration, price, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(planId, name, duration, price, description || '', sort_order || 0);

      res.json({ ok: true, plan: { id: planId, name, duration, price, description, sort_order } });
    } catch (e) {
      console.error('[Admin] 创建套餐失败:', e);
      res.status(500).json({ ok: false, error: '创建套餐失败' });
    }
  });

  router.put('/plans/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, duration, price, description, sort_order, is_active } = req.body;

      if (!name || !duration || !price) {
        return res.status(400).json({ ok: false, error: '请填写完整信息' });
      }

      if (duration <= 0 || price <= 0) {
        return res.status(400).json({ ok: false, error: '时长和价格必须大于0' });
      }

      const existing = db.prepare('SELECT id FROM pricing_plans WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({ ok: false, error: '套餐不存在' });
      }

      db.prepare(`
        UPDATE pricing_plans 
        SET name = ?, duration = ?, price = ?, description = ?, sort_order = ?, is_active = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, duration, price, description || '', sort_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, id);

      res.json({ ok: true });
    } catch (e) {
      console.error('[Admin] 更新套餐失败:', e);
      res.status(500).json({ ok: false, error: '更新套餐失败' });
    }
  });

  router.delete('/plans/:id', (req, res) => {
    try {
      const { id } = req.params;

      const existing = db.prepare('SELECT id FROM pricing_plans WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({ ok: false, error: '套餐不存在' });
      }

      db.prepare('DELETE FROM pricing_plans WHERE id = ?').run(id);

      res.json({ ok: true });
    } catch (e) {
      console.error('[Admin] 删除套餐失败:', e);
      res.status(500).json({ ok: false, error: '删除套餐失败' });
    }
  });

  router.get('/recharge-records', (req, res) => {
    try {
      const { page = 1, limit = 20, status, user_id } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status) {
        whereClause += ' AND r.status = ?';
        params.push(status);
      }

      if (user_id) {
        whereClause += ' AND r.user_id = ?';
        params.push(user_id);
      }

      const records = db.prepare(`
        SELECT r.*, p.name as plan_name, p.duration as plan_duration, u.username 
        FROM recharge_records r 
        LEFT JOIN pricing_plans p ON r.plan_id = p.id 
        LEFT JOIN users u ON r.user_id = u.id 
        ${whereClause}
        ORDER BY r.created_at DESC 
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), offset);

      const total = db.prepare(`
        SELECT COUNT(*) as count 
        FROM recharge_records r 
        ${whereClause}
      `).get(...params).count;

      res.json({ 
        ok: true, 
        records, 
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (e) {
      console.error('[Admin] 获取充值记录失败:', e);
      res.status(500).json({ ok: false, error: '获取充值记录失败' });
    }
  });

  return router;
}

module.exports = { createAdminRechargeRoutes };