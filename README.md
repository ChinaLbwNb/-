# AI 面试助手

一个基于 AI 的智能面试辅助系统，支持实时语音识别、简历解析、智能回答生成和充值付费功能。

## 📋 项目简介

AI 面试助手是一个全栈应用，旨在帮助求职者更好地准备面试。系统通过实时语音识别捕获面试官的问题，结合用户上传的简历信息，利用大语言模型生成专业、个性化的回答建议。

### 核心功能

- 🎤 **实时语音识别**：集成讯飞 ASR，实时转录面试官的问题
- 📄 **简历智能解析**：支持 PDF/Word 格式，包含 OCR 识别扫描文档
- 🤖 **AI 智能回答**：基于简历和职位信息生成个性化回答
- 💰 **充值付费系统**：支持支付宝支付，按面试时长计费
- 👨‍💼 **管理员后台**：用户管理、套餐管理、数据统计
- 🔐 **用户认证**：JWT 认证，支持管理员权限控制

## 🛠️ 技术栈

### 前端技术
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 组件**：shadcn/ui + Tailwind CSS
- **状态管理**：Zustand
- **音频处理**：AudioContext + AudioWorklet
- **网络请求**：Fetch API

### 后端技术
- **运行时**：Node.js
- **Web 框架**：Express
- **数据库**：SQLite (better-sqlite3)
- **认证**：JWT + bcrypt
- **WebSocket**：ws 库
- **文件处理**：multer + pdfjs-dist + Tesseract.js

### 第三方服务
- **语音识别**：讯飞实时语音识别 API
- **大语言模型**：OpenAI/SiliconFlow 兼容接口
- **支付**：支付宝支付
- **OCR**：Tesseract.js

## 📦 项目结构

```
app/
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── sections/           # 页面组件
│   ├── hooks/              # 自定义 Hooks
│   ├── types/              # TypeScript 类型定义
│   └── App.tsx             # 应用入口
├── server/                 # 后端源码
│   ├── config/             # 配置文件
│   │   ├── asr_config.json         # 讯飞 ASR 配置
│   │   ├── prompt_config.json      # Prompt 配置
│   │   └── payment_config.json     # 支付配置
│   ├── db/                 # 数据库
│   │   └── database.cjs    # SQLite 数据库初始化
│   ├── routes/             # API 路由
│   │   ├── auth.cjs        # 认证相关
│   │   ├── upload.cjs      # 文件上传
│   │   ├── recharge.cjs    # 充值功能
│   │   ├── payment.cjs     # 支付功能
│   │   ├── interview.cjs   # 面试管理
│   │   └── admin_recharge.cjs # 管理员充值管理
│   └── index.cjs           # 服务器入口
├── test/                   # 测试文件
├── package.json
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装依赖

```bash
cd app
npm install
```

### 配置文件

#### 1. 讯飞 ASR 配置

编辑 `server/config/asr_config.json`：

```json
{
  "app_id": "你的讯飞应用ID",
  "api_key": "你的讯飞API Key",
  "api_secret": "你的讯飞API Secret",
  "business": {
    "language": "zh_cn",
    "domain": "iat",
    "accent": "mandarin",
    "vad_eos": 60000,
    "dwa": "wpgs"
  }
}
```

#### 2. 大模型配置

编辑 `server/config/prompt_config.json`：

```json
{
  "api_base": "https://api.openai.com/v1",
  "api_key": "你的API Key",
  "model": "gpt-3.5-turbo",
  "system_prompt": "你是一个面试助手...",
  "task": "根据问题，结合自身简历与项目经历，给出简洁、专业的回答。"
}
```

#### 3. 支付宝配置

编辑 `server/config/payment_config.json`：

```json
{
  "alipay": {
    "app_id": "支付宝应用ID",
    "private_key": "应用私钥",
    "public_key": "支付宝公钥",
    "notify_url": "支付回调地址",
    "return_url": "支付返回地址"
  }
}
```

### 启动服务

```bash
npm run server
```

访问 http://localhost:8000 即可使用。

### 构建生产版本

```bash
npm run build
```

## 📖 功能说明

### 1. 用户认证

- 用户注册/登录
- JWT Token 认证
- 管理员权限控制
- 登录日志记录

### 2. 简历管理

- 支持 PDF 和 Word 格式上传
- PDF 文本自动提取
- OCR 识别扫描版 PDF
- 简历信息结构化解析

### 3. 面试流程

1. **上传简历**：上传并解析简历信息
2. **选择职位**：选择目标面试职位
3. **音频设置**：配置系统音频捕获
4. **开始面试**：
   - 实时语音识别面试官问题
   - 1 秒静默检测问题结束
   - AI 自动生成回答建议
   - 实时显示剩余时长
5. **结束面试**：自动扣除使用时长

### 4. 充值付费

- 多种充值套餐选择
- 支付宝在线支付
- 实时余额显示
- 充值记录查询
- 按实际使用时长计费

### 5. 管理员功能

- 用户管理（查看、禁用）
- 充值套餐管理
- 充值记录查询
- Prompt 模板管理
- 登录日志查看
- 数据统计概览

## 🔧 API 接口

### 认证相关

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 简历相关

- `POST /api/upload/resume` - 上传简历
- `GET /api/upload/resume` - 获取简历信息

### 面试相关

- `POST /api/interview/start` - 开始面试
- `POST /api/interview/end` - 结束面试
- `GET /api/interview/current` - 获取当前会话
- `GET /api/interview/history` - 获取面试历史

### 充值相关

- `GET /api/recharge/plans` - 获取充值套餐
- `GET /api/recharge/balance` - 获取用户余额
- `GET /api/recharge/records` - 获取充值记录

### 支付相关

- `POST /api/payment/create` - 创建支付订单
- `POST /api/payment/alipay/notify` - 支付宝回调
- `GET /api/payment/status/:id` - 查询订单状态

### 管理员接口

- `GET /api/admin/users` - 获取用户列表
- `PUT /api/admin/users/:id` - 更新用户信息
- `GET /api/admin/login-logs` - 获取登录日志
- `POST /api/admin/recharge/plans` - 创建充值套餐
- `PUT /api/admin/recharge/plans/:id` - 更新套餐
- `DELETE /api/admin/recharge/plans/:id` - 删除套餐

## 🎨 界面预览

### 主要页面

1. **登录页面**：用户认证入口
2. **欢迎页面**：职位选择和开始面试
3. **简历上传**：上传和解析简历
4. **音频设置**：配置系统音频捕获
5. **面试界面**：实时语音识别和 AI 回答
6. **充值中心**：套餐选择和支付
7. **管理员后台**：系统管理控制台

## 🔒 安全特性

- 密码 bcrypt 加密存储
- JWT Token 认证机制
- SQL 注入防护
- XSS 攻击防护
- 支付签名验证
- 文件上传类型验证

## 📊 数据库设计

### 主要数据表

- `users` - 用户信息
- `sessions` - 会话管理
- `login_logs` - 登录日志
- `resumes` - 简历信息
- `prompts` - Prompt 模板
- `pricing_plans` - 充值套餐
- `recharge_records` - 充值记录
- `interview_sessions` - 面试会话

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [讯飞开放平台](https://www.xfyun.cn/) - 语音识别服务
- [OpenAI](https://openai.com/) - 大语言模型
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR 引擎

## 📞 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至：your-email@example.com

---

**注意**：本项目仅供学习和研究使用，请勿用于商业用途。使用前请确保遵守相关服务条款和法律法规。
