const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');

function createPaymentRoutes(db) {
  const router = require('express').Router();

  function loadPaymentConfig() {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '..', 'config', 'payment_config.json');
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Payment] 加载支付配置失败:', e);
      return null;
    }
  }

  function generateAlipaySign(params, privateKey) {
    const sortedParams = Object.keys(params).sort();
    const signString = sortedParams.map(key => `${key}=${params[key]}`).join('&');
    const sign = CryptoJS.HmacSHA256(signString, privateKey).toString(CryptoJS.enc.Base64);
    return sign;
  }

  function verifyAlipaySign(params, publicKey) {
    const sign = params.sign;
    const signString = Object.keys(params)
      .filter(key => key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const verify = CryptoJS.HmacSHA256(signString, publicKey).toString(CryptoJS.enc.Base64);
    return verify === sign;
  }

  router.post('/create', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const { plan_id, payment_method } = req.body;
      if (!plan_id || !payment_method) {
        return res.status(400).json({ ok: false, error: '请选择套餐和支付方式' });
      }

      if (payment_method !== 'alipay') {
        return res.status(400).json({ ok: false, error: '暂只支持支付宝支付' });
      }

      const config = loadPaymentConfig();
      if (!config || !config.alipay) {
        return res.status(500).json({ ok: false, error: '支付配置未完成' });
      }

      const plan = db.prepare('SELECT * FROM pricing_plans WHERE id = ? AND is_active = 1').get(plan_id);
      if (!plan) {
        return res.status(400).json({ ok: false, error: '套餐不存在' });
      }

      const orderId = uuidv4();
      const timestamp = Date.now();
      
      const orderRecord = db.prepare(`
        INSERT INTO recharge_records (id, user_id, plan_id, duration, amount, payment_method, status, transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orderId, userId, plan_id, plan.duration, plan.price, 'alipay', 'pending', orderId);

      const alipayParams = {
        app_id: config.alipay.app_id,
        method: 'alipay.trade.page.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: timestamp.toString(),
        version: '1.0',
        notify_url: config.alipay.notify_url,
        return_url: config.alipay.return_url,
        out_trade_no: orderId,
        total_amount: (plan.price / 100).toFixed(2),
        subject: `充值${plan.duration}秒`,
        body: `购买面试时长套餐：${plan.name}`,
      };

      const sign = generateAlipaySign(alipayParams, config.alipay.private_key);
      alipayParams.sign = sign;

      console.log('[Payment] 创建支付宝订单:', orderId, '金额:', plan.price);

      res.json({
        ok: true,
        order_id: orderId,
        payment_url: `https://openapi.alipay.com/gateway.do?${new URLSearchParams(alipayParams).toString()}`
      });
    } catch (e) {
      console.error('[Payment] 创建支付订单失败:', e);
      res.status(500).json({ ok: false, error: '创建支付订单失败' });
    }
  });

  router.post('/alipay/notify', async (req, res) => {
    try {
      console.log('[Payment] 收到支付宝回调');
      
      const config = loadPaymentConfig();
      if (!config || !config.alipay) {
        return res.status(500).send('支付配置未完成');
      }

      const params = req.body;
      const { out_trade_no, trade_status, total_amount, gmt_payment, sign } = params;

      console.log('[Payment] 支付宝回调参数:', { out_trade_no, trade_status, total_amount });

      if (!verifyAlipaySign(params, config.alipay.public_key)) {
        console.error('[Payment] 支付宝签名验证失败');
        return res.send('fail');
      }

      if (trade_status !== 'TRADE_SUCCESS') {
        console.log('[Payment] 支付失败:', trade_status);
        return res.send('fail');
      }

      const order = db.prepare('SELECT * FROM recharge_records WHERE id = ?').get(out_trade_no);
      if (!order) {
        console.error('[Payment] 订单不存在:', out_trade_no);
        return res.send('fail');
      }

      if (order.status !== 'pending') {
        console.log('[Payment] 订单状态异常:', order.status);
        return res.send('success');
      }

      db.prepare('BEGIN TRANSACTION').run();

      try {
        db.prepare(`
          UPDATE recharge_records 
          SET status = 'completed', 
              payment_method = 'alipay',
              paid_at = datetime('now'),
              notify_data = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(out_trade_no);

        db.prepare(`
          UPDATE users 
          SET balance = balance + ?, 
              updated_at = datetime('now')
          WHERE id = ?
        `).run(order.duration, order.user_id);

        db.prepare('COMMIT').run();

        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(order.user_id);
        console.log('[Payment] 支付成功，用户余额:', user.balance);

        res.send('success');
      } catch (e) {
        db.prepare('ROLLBACK').run();
        console.error('[Payment] 支付处理失败:', e);
        res.send('fail');
      }
    } catch (e) {
      console.error('[Payment] 支付宝回调处理失败:', e);
      res.send('fail');
    }
  });

  router.get('/status/:id', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: '未登录' });
      }

      const { id } = req.params;
      const order = db.prepare(`
        SELECT r.*, p.name as plan_name, p.duration as plan_duration 
        FROM recharge_records r 
        LEFT JOIN pricing_plans p ON r.plan_id = p.id 
        WHERE r.id = ? AND r.user_id = ?
      `).get(id, userId);

      if (!order) {
        return res.status(404).json({ ok: false, error: '订单不存在' });
      }

      res.json({
        ok: true,
        order: {
          id: order.id,
          plan_name: order.plan_name,
          plan_duration: order.plan_duration,
          amount: order.amount,
          payment_method: order.payment_method,
          status: order.status,
          paid_at: order.paid_at,
          created_at: order.created_at
        }
      });
    } catch (e) {
      console.error('[Payment] 查询订单状态失败:', e);
      res.status(500).json({ ok: false, error: '查询订单状态失败' });
    }
  });

  router.get('/return', async (req, res) => {
    try {
      const { out_trade_no, trade_status } = req.query;
      console.log('[Payment] 支付宝同步返回:', { out_trade_no, trade_status });

      const order = db.prepare('SELECT * FROM recharge_records WHERE id = ?').get(out_trade_no);
      if (!order) {
        return res.status(404).send('订单不存在');
      }

      if (trade_status === 'TRADE_SUCCESS' && order.status === 'pending') {
        db.prepare(`
          UPDATE recharge_records 
          SET status = 'completed', 
              paid_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(out_trade_no);
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>支付结果</title>
        </head>
        <body>
          <h1>${trade_status === 'TRADE_SUCCESS' ? '支付成功' : '支付失败'}</h1>
          <p>订单号：${out_trade_no}</p>
          <p>您可以关闭此页面</p>
        </body>
        </html>
      `);
    } catch (e) {
      console.error('[Payment] 支付返回处理失败:', e);
      res.status(500).send('处理失败');
    }
  });

  return router;
}

module.exports = { createPaymentRoutes };