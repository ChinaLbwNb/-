const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

// ================= 数据库初始化 =================
const { initDatabase } = require('./db/database.cjs');
initDatabase();

// ================= Prompt 管理 =================
const { getSystemPrompt } = require('./db/prompts.cjs');

// ================= 认证路由 =================
const { router: authRouter, authMiddleware } = require('./routes/auth.cjs');

// ================= 上传路由 =================
const uploadRouter = require('./routes/upload.cjs');

// ================= 充值路由 =================
const { createRechargeRoutes } = require('./routes/recharge.cjs');
const rechargeRouter = createRechargeRoutes(require('./db/database.cjs').db);

// ================= 面试路由 =================
const { createInterviewRoutes } = require('./routes/interview.cjs');
const interviewRouter = createInterviewRoutes(require('./db/database.cjs').db);

// ================= 支付路由 =================
const { createPaymentRoutes } = require('./routes/payment.cjs');
const paymentRouter = createPaymentRoutes(require('./db/database.cjs').db);

// ================= 管理员充值路由 =================
const { createAdminRechargeRoutes } = require('./routes/admin_recharge.cjs');
const adminRechargeRouter = createAdminRechargeRoutes(require('./db/database.cjs').db);

// ================= 基本配置（你只需改 json 文件） =================

// 监听端口
const PORT = process.env.PORT || 8000;

// 配置文件路径
const CONFIG_DIR = path.join(__dirname, 'config');
const ASR_CONFIG_PATH = path.join(CONFIG_DIR, 'asr_config.json');
const LLM_CONFIG_PATH = path.join(CONFIG_DIR, 'llm_config.json');
const PROMPT_CONFIG_PATH = path.join(CONFIG_DIR, 'prompt_config.json');

let asrConfigCache = null;
let llmConfigCache = null;
let promptConfigCache = null;

function loadJsonConfig(configPath, tag) {
  try {
    if (!fs.existsSync(configPath)) {
      console.warn(`[${tag}] 未找到配置文件，将使用占位配置。路径:`, configPath);
      return null;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[${tag}] 读取/解析配置失败，将使用占位配置。`, e.message || e);
    return null;
  }
}

function loadAsrConfig() {
  asrConfigCache = loadJsonConfig(ASR_CONFIG_PATH, 'ASR');
  return asrConfigCache;
}

function getAsrConfig() {
  // 每次调用都从文件重新加载，保证配置修改后无需重启即可生效
  return loadAsrConfig();
}

function loadPromptConfig() {
  promptConfigCache = loadJsonConfig(PROMPT_CONFIG_PATH, 'Prompt');
  return promptConfigCache;
}

function getPromptConfig() {
  // 每次调用都从文件重新加载，保证配置修改后无需重启即可生效
  return loadPromptConfig();
}

/** 取出用于 LLM 的 system 提示词：
 * - 始终包含后端配置的 role 和 task
 * - 若有 system_prompt，则拼在最后
 * - 若三者都为空，则返回默认占位文案
 */
function getSystemPromptFromConfig() {
  const p = getPromptConfig();
  if (!p) {
    return '你是一名面试回答助手。根据面试官的问题，给出简洁、专业的回答。';
  }
  const role = typeof p.role === 'string' ? p.role.trim() : '';
  const task = typeof p.task === 'string' ? p.task.trim() : '';
  const system = typeof p.system_prompt === 'string' && p.system_prompt.trim() ? p.system_prompt.trim() : '';
  const parts = [role, task, system].filter(Boolean);
  if (parts.length > 0) {
    return parts.join('\n');
  }
  return '你是一名面试回答助手。根据面试官的问题，给出简洁、专业的回答。';
}

/** 是否向前端返回调试信息（默认关闭）。配置在 server/config/prompt_config.json */
function isDebugEnabled() {
  const p = getPromptConfig();
  if (!p) return false;
  // 兼容多种写法：debug.enabled / enable_debug / debug_enabled
  if (typeof p.enable_debug === 'boolean') return p.enable_debug;
  if (typeof p.debug_enabled === 'boolean') return p.debug_enabled;
  if (p.debug && typeof p.debug.enabled === 'boolean') return p.debug.enabled;
  return false;
}

/** 去掉配置里仅供注释的字段（如 //_comment），避免讯飞接口报 param validate error */
function sanitizeForXfyun(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (String(k).startsWith('//')) continue;
    out[k] = v;
  }
  return out;
}

function loadLlmConfig() {
  llmConfigCache = loadJsonConfig(LLM_CONFIG_PATH, 'LLM');
  return llmConfigCache;
}

function getLlmConfig() {
  // 每次调用都从文件重新加载，保证配置修改后无需重启即可生效
  return loadLlmConfig();
}

// ================= 讯飞鉴权 URL 生成（根据官方文档实现） =================

function buildXfyunAuthUrl(hostUrl, apiKey, apiSecret) {
  const urlObj = new URL(hostUrl);
  const host = urlObj.host;
  const date = new Date().toUTCString(); // RFC1123, GMT

  // signature_origin: host: $host\ndate: $date\nGET /v2/iat HTTP/1.1
  const signatureOrigin = [
    `host: ${host}`,
    `date: ${date}`,
    `GET ${urlObj.pathname} HTTP/1.1`,
  ].join('\n');

  // 使用 CryptoJS.HmacSHA256，与官方 demo 一致
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);

  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin));

  const params = new URLSearchParams();
  params.set('authorization', authorization);
  params.set('date', date);
  params.set('host', host);

  return `${hostUrl}?${params.toString()}`;
}

// ================= 与讯飞建立 WebSocket 连接（你可以在这里细化业务参数） =================

function createXfyunWs() {
  const cfg = getAsrConfig();
  if (!cfg || !cfg.app_id || !cfg.api_key || !cfg.api_secret) {
    console.warn('[XFyun] app_id / api_key / api_secret 未在 asr_config.json 中配置，当前仅做占位，不会真正连接讯飞。');
    return null;
  }

  const hostUrl = cfg.iat_url || 'wss://iat-api.xfyun.cn/v2/iat';
  const authUrl = buildXfyunAuthUrl(hostUrl, cfg.api_key, cfg.api_secret);
  const xfWs = new WebSocket(authUrl);

  xfWs.on('open', () => {
    console.log('[XFyun] WebSocket 已连接');
  });

  xfWs.on('error', (err) => {
    console.error('[XFyun] WebSocket 错误:', err.message || err);
  });

  return xfWs;
}

// 将讯飞 JSON 结果解析成纯文本（你可以根据需要调整为带标点/多候选）
function extractTextFromXfyunResult(json) {
  try {
    if (!json || json.code !== 0 || !json.data || !json.data.result) return '';
    const result = json.data.result;
    const wsArray = result.ws || [];
    let text = '';
    for (const ws of wsArray) {
      const cwArray = ws.cw || [];
      for (const cw of cwArray) {
        if (cw.w) text += cw.w;
      }
    }
    return text;
  } catch {
    return '';
  }
}

// ================= HTTP + WebSocket 服务骨架 =================

const app = express();
const server = http.createServer(app);
app.use(cors({
  origin: function(origin, callback) {
    // 允许所有来源（开发环境）
    callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
}));
app.use(express.json());
app.use(cookieParser());

// 挂载认证路由
app.use('/api/auth', authRouter);

// 挂载上传路由
app.use('/api/upload', uploadRouter);

// 挂载充值路由
app.use('/api/recharge', authMiddleware, rechargeRouter);

// 挂载支付路由
app.use('/api/payment', authMiddleware, paymentRouter);

// 挂载面试路由
app.use('/api/interview', authMiddleware, interviewRouter);

// 挂载管理员充值路由
app.use('/api/admin/recharge', authMiddleware, adminRechargeRouter);

// 显式响应预检，避免部分环境仍报 CORS
app.options('/api/answer', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

// 简单健康检查/初始化接口：前端初始化模块可以调用这里
app.get('/api/health', (req, res) => {
  const cfg = getAsrConfig();
  const llm = getLlmConfig();
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    asrConfigured: !!(cfg && cfg.app_id && cfg.api_key && cfg.api_secret),
    llmConfigured: !!(
      llm &&
      llm.default_protocol &&
      llm.protocols &&
      llm.protocols[llm.default_protocol] &&
      llm.protocols[llm.default_protocol].api_key
    ),
  });
});

// 当前系统提示词（供前端展示用）
app.get('/api/prompt', (req, res) => {
  res.json({
    ok: true,
    system_prompt: getSystemPromptFromConfig(),
    enable_debug: isDebugEnabled(),
  });
});

// ========== LLM 调用（OpenAI / SiliconFlow 兼容） ==========
// 返回 { answer, debug } 或抛错（debug 会附在 Error 上）
async function callLlmOpenAI(cfg, messages, timeoutMs) {
  const url = `${cfg.base_url.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: cfg.model,
    messages,
    stream: false,
    max_tokens: cfg.parameters?.max_tokens ?? 2048,
    temperature: cfg.parameters?.temperature ?? 0.7,
    top_p: cfg.parameters?.top_p ?? 0.7,
  };
  const debug = {
    requestUrl: url,
    model: cfg.model,
    protocol: 'openai',
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 30000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    debug.status = 'network_error';
    debug.message = e.message || String(e);
    const err = new Error(debug.message);
    err.debug = debug;
    throw err;
  }
  clearTimeout(timeoutId);
  debug.httpStatus = res.status;
  if (!res.ok) {
    const errText = await res.text();
    debug.status = 'http_error';
    debug.message = errText.slice(0, 500);
    const err = new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
    err.debug = debug;
    throw err;
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  let content = msg?.content;
  if (content != null) {
    // 去掉开头多余的空格和空行，避免回答正文前出现大块空白
    content = String(content).replace(/^\s+/, '');
  }
  if (content == null || String(content).trim() === '') {
    debug.status = 'parse_error';
    debug.message = '响应无 content';
    debug.rawPreview = JSON.stringify(data).slice(0, 300);
    const err = new Error('LLM 返回无 content，请检查模型与 API 配置');
    err.debug = debug;
    throw err;
  }
  debug.status = 'ok';
  return { answer: String(content), debug };
}

app.post('/api/answer', authMiddleware, async (req, res) => {
  const llm = getLlmConfig();
  if (
    !llm ||
    !llm.default_protocol ||
    !llm.protocols ||
    !llm.protocols[llm.default_protocol] ||
    !llm.protocols[llm.default_protocol].api_key
  ) {
    return res.status(500).json({
      ok: false,
      error: 'LLM 配置未完成，请先在 server/config/llm_config.json 中填写 api_key 等信息。',
    });
  }

  const protocol = llm.default_protocol;
  const cfg = llm.protocols[protocol];
  const { question, session_id, docs, history, prompt_override } = req.body || {};

  // OpenAI / SiliconFlow 使用同一套 chat/completions 接口
  const isOpenAICompatible = protocol === 'openai' || protocol === 'siliconflow';

  if (isOpenAICompatible) {
    try {
      // 优先从数据库获取系统 Prompt
      const dbSystemPrompt = getSystemPrompt();
      let systemContent = '';
      
      if (dbSystemPrompt && dbSystemPrompt.content) {
        // 使用数据库中的系统 Prompt
        systemContent = dbSystemPrompt.content;
      } else {
        // 回退到配置文件
        const basePromptConfig = getPromptConfig();
        const baseRole = basePromptConfig && typeof basePromptConfig.role === 'string' ? basePromptConfig.role.trim() : '';
        const baseTask = basePromptConfig && typeof basePromptConfig.task === 'string' ? basePromptConfig.task.trim() : '';
        const baseSystem =
          basePromptConfig && typeof basePromptConfig.system_prompt === 'string'
            ? basePromptConfig.system_prompt.trim()
            : '';

        // 前端临时 prompt 只覆盖 system_prompt 部分，role / task 始终来自后端配置
        const overrideCore =
          typeof prompt_override === 'string' && prompt_override.trim() ? prompt_override.trim() : baseSystem;

        const promptParts = [baseRole, baseTask, overrideCore].filter(Boolean);
        systemContent =
          promptParts.length > 0
            ? promptParts.join('\n')
            : '你是一名面试回答助手。根据面试官的问题，给出简洁、专业的回答。';
      }
      const docsBlock =
        Array.isArray(docs) && docs.length > 0
          ? '参考文档摘要：' + docs.map((d) => (typeof d === 'string' ? d : d.text || d.content || '')).join('\n').slice(0, 3000)
          : '';

      const messages = [{ role: 'system', content: systemContent }];
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-10).forEach((item) => {
          const role = item.type === 'question' ? 'user' : 'assistant';
          const content = item.content || '';
          if (content) messages.push({ role, content });
        });
      }
      const userParts = [];
      if (docsBlock) userParts.push(docsBlock);
      userParts.push(question || '');
      messages.push({ role: 'user', content: userParts.filter(Boolean).join('\n\n') });

      const result = await callLlmOpenAI(cfg, messages, cfg.timeout || 30000);
      return res.json({
        ok: true,
        protocol,
        model: cfg.model,
        answer: result.answer,
        ...(isDebugEnabled() ? { debug: result.debug } : {}),
      });
    } catch (e) {
      const errMsg = e.message || String(e);
      const debug = e.debug || { status: 'error', message: errMsg };
      console.error('[LLM] 调用失败:', errMsg);
      return res.status(500).json({
        ok: false,
        error: errMsg,
        ...(isDebugEnabled() ? { debug } : {}),
      });
    }
  }

  // Anthropic 等其它协议可在此扩展
  return res.status(501).json({
    ok: false,
    error: `当前未实现协议: ${protocol}，请使用 default_protocol: "openai" 或 "siliconflow"。`,
  });
});

// WebSocket：前端 InterviewStep 连接的地址 ws://localhost:8000/ws/asr
const wss = new WebSocket.Server({ server, path: '/ws/asr' });

wss.on('connection', (clientWs) => {
  console.log('[ASR] 前端已连接');

  let xfWs = createXfyunWs();
  let firstFrameSent = false;
  let closed = false;
  let xfSessionEnded = false;
  const audioBuffer = [];

  function sendToClient(payload) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  }

  if (xfWs) {
    xfWs.on('message', (data) => {
      try {
        const json = JSON.parse(data.toString());
        if (json.code !== 0) {
          console.error('[XFyun] 识别错误:', json.code, json.message);
          sendToClient({ type: 'error', text: `ASR 错误 ${json.code}: ${json.message || '未知'}` });
          return;
        }
        const text = extractTextFromXfyunResult(json);
        if (text) {
          const status = json.data && typeof json.data.status === 'number' ? json.data.status : 1;
          sendToClient({ type: status === 2 ? 'final' : 'partial', text });
          if (status === 2) {
            console.log('[XFyun] 会话结束，标记需要重建连接');
            xfSessionEnded = true;
            firstFrameSent = false;
            audioBuffer.length = 0; // 清空缓冲区
          }
        }
      } catch (e) {
        console.error('[XFyun] 解析结果失败:', e);
      }
    });

    xfWs.on('open', () => {
      console.log('[XFyun] WebSocket 已连接');
      const cfg = getAsrConfig();
      let bufFirst = true;
      while (audioBuffer.length > 0) {
        const msg = audioBuffer.shift();
        const audioBase64 = Buffer.from(msg).toString('base64');
        const status = bufFirst ? 0 : 1;
        bufFirst = false;
        firstFrameSent = true;
        const dataSection = { status, format: 'audio/L16;rate=16000', encoding: 'raw', audio: audioBase64 };
        const business = sanitizeForXfyun((cfg && cfg.business) || { language: 'zh_cn', domain: 'iat', accent: 'mandarin', vad_eos: 3000, dwa: 'wpgs' });
        const frame =
          status === 0
            ? { common: { app_id: (cfg && cfg.app_id) || '' }, business, data: dataSection }
            : { data: dataSection };
        try {
          xfWs.send(JSON.stringify(frame));
        } catch (e) {
          console.error('[XFyun] 发送缓冲帧失败:', e);
        }
      }
    });

    xfWs.on('close', () => {
      console.log('[XFyun] 连接已关闭');
    });
  } else {
    sendToClient({
      type: 'partial',
      text: '【未配置讯飞 ASR，请在 server/config/asr_config.json 中填写 app_id / api_key / api_secret】',
    });
  }

  clientWs.on('message', (msg) => {
    if (!xfWs) return;

    // 如果讯飞会话已结束，等待新的音频数据到达时才创建新连接
    if (xfSessionEnded) {
      console.log('[ASR] 讯飞会话已结束，等待新音频数据...');
      if (xfWs && xfWs.readyState === WebSocket.OPEN) {
        xfWs.close();
      }
      xfWs = createXfyunWs();
      xfSessionEnded = false;
      firstFrameSent = false;
      audioBuffer.length = 0; // 清空缓冲区，避免发送旧数据
      if (xfWs) {
        xfWs.on('message', (data) => {
          try {
            const json = JSON.parse(data.toString());
            if (json.code !== 0) {
              console.error('[XFyun] 识别错误:', json.code, json.message);
              sendToClient({ type: 'error', text: `ASR 错误 ${json.code}: ${json.message || '未知'}` });
              return;
            }
            const text = extractTextFromXfyunResult(json);
            if (text) {
              const status = json.data && typeof json.data.status === 'number' ? json.data.status : 1;
              sendToClient({ type: status === 2 ? 'final' : 'partial', text });
              if (status === 2) {
                console.log('[XFyun] 会话结束，标记需要重建连接');
                xfSessionEnded = true;
                firstFrameSent = false;
                audioBuffer.length = 0;
              }
            }
          } catch (e) {
            console.error('[XFyun] 解析结果失败:', e);
          }
        });
        xfWs.on('open', () => {
          console.log('[XFyun] 新连接已建立');
        });
        xfWs.on('close', () => console.log('[XFyun] 连接已关闭'));
        xfWs.on('error', (err) => console.error('[XFyun] 连接错误:', err.message || err));
      }
    }

    if (xfWs.readyState !== WebSocket.OPEN) {
      audioBuffer.push(msg);
      return;
    }

    const cfg = getAsrConfig();
    const audioBase64 = Buffer.from(msg).toString('base64');
    const status = firstFrameSent ? 1 : 0;
    firstFrameSent = true;

    const dataSection = {
      status,
      format: 'audio/L16;rate=16000',
      encoding: 'raw',
      audio: audioBase64,
    };
    const business = sanitizeForXfyun((cfg && cfg.business) || { language: 'zh_cn', domain: 'iat', accent: 'mandarin', vad_eos: 3000, dwa: 'wpgs' });
    const frame =
      status === 0
        ? { common: { app_id: (cfg && cfg.app_id) || '' }, business, data: dataSection }
        : { data: dataSection };

    try {
      xfWs.send(JSON.stringify(frame));
    } catch (e) {
      console.error('[XFyun] 发送音频帧失败:', e);
    }
  });

  clientWs.on('close', () => {
    console.log('[ASR] 前端连接关闭');
    if (closed) return;
    closed = true;

    // 告诉讯飞“最后一帧”，按文档必须发送一次 status=2
    if (xfWs && xfWs.readyState === WebSocket.OPEN) {
      const endFrame = {
        data: {
          status: 2,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: '',
        },
      };
      try {
        xfWs.send(JSON.stringify(endFrame));
      } catch (e) {
        console.error('[XFyun] 发送结束帧失败:', e);
      }
      xfWs.close();
    }
  });

  clientWs.on('error', (err) => {
    console.error('[ASR] 前端 WebSocket 错误:', err.message || err);
  });
});

// 单端口合并：同一端口提供 API + 前端页面
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(DIST_DIR)) {
  console.log('[Server] 未找到 dist，正在构建前端…');
  require('child_process').execSync('npm run build', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
}
// 根路径直接返回前端页面，避免被其他路由或中间件返回 JSON
app.get('/', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});
app.use(express.static(DIST_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('前端+接口已合并，浏览器访问上述地址即可');
});

