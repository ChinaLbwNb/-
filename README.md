# AiTool（单端口：前端 + API + WebSocket）

一个用于“面试问答 + 语音识别（ASR）”的 Web 应用，内置**用户注册/登录**、**用户设置**与**管理员后台**。项目采用**单端口部署**：同一个端口同时提供前端静态页面、HTTP API 与 WebSocket。

## 功能一览

- **面试问答**
  - `POST /api/answer` 调用大模型生成回答（需登录）
  - 支持“本页临时 Prompt”（只对当前页面/本次请求生效，不会写回服务器配置）
- **ASR 语音识别**
  - WebSocket：`/ws/asr`（需登录）
- **账号系统（SQLite + Cookie Session）**
  - 注册：用户名唯一校验、密码强度校验（≥8 位，且包含字母 + 数字）
  - 登录：失败次数限制（连续 5 次失败锁定 10 分钟）、登录日志（IP/时间/UA）
  - 退出登录：`POST /api/auth/logout`
  - 7 天免登：Session Cookie 默认 `maxAge=7天`（无需 JWT）
- **用户信息管理**
  - 用户名不可改
  - 邮箱绑定/换绑
  - 修改密码
- **管理员后台**
  - 用户列表查询、编辑邮箱/状态、软删除
  - 查看登录日志

## 技术栈

- **前端**：React + TypeScript + Vite + Tailwind（shadcn/ui 风格）
- **后端**：Node.js + Express + WebSocket(`ws`)
- **鉴权**：`express-session` + SQLite session store（`better-sqlite3-session-store`）
- **数据库**：SQLite（`better-sqlite3`）

## 目录结构（简要）

主要代码都在 `app/` 下：

- `app/src/`：前端源码（路由入口 `app/src/App.tsx`）
- `app/server/`：后端源码（入口 `app/server/index.cjs`）
- `app/server/config/`：运行时配置（支持热加载）
  - `prompt_config.json`
  - `llm_config.json`
  - `asr_config.json`
- `app/server/data/`：SQLite 数据库（`app.db`）

更详细的拆分说明见：`app/README.arch.md`。

## 快速开始（开发 / 本地）

### 1）安装依赖

```bash
cd app
npm install
```

### 2）启动服务（单端口）

```bash
cd app
npm run server
```

默认监听：`http://localhost:8080`

> 说明：本项目后端会托管 `app/dist/` 的静态文件。若你修改了前端代码，需要先构建一次。

### 3）构建并启动（推荐给“像生产一样跑”的方式）

```bash
cd app
npm run start
```

## 账号与管理员

### 注册/登录入口

- 登录页：`/login`
- 注册页：`/register`

登录后右上角可进入：
- **账号设置**：`/settings`
- **管理员后台**（仅管理员可见）：`/admin`
- **退出登录**

### 一键创建管理员（admin/admin）

```bash
cd app
node server/scripts/create-admin.cjs
```

## 配置（支持热加载）

修改以下文件后，**无需重启**，下次请求会自动读取新配置：

- `app/server/config/prompt_config.json`
- `app/server/config/llm_config.json`
- `app/server/config/asr_config.json`

## 生产环境注意事项

- **必须设置 `SESSION_SECRET`**（否则服务会拒绝启动）：

```powershell
$env:NODE_ENV="production"
$env:SESSION_SECRET="请换成随机长字符串"
cd app
npm run start
```

- **HTTPS / WSS**：若通过反向代理或内网穿透对外提供服务，请确保代理正确转发 WebSocket，并在外部使用 `https` / `wss`。

## 主要接口速查

认证：
- `POST /api/auth/register` `{ username, password }`
- `POST /api/auth/login` `{ username, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

用户（需登录）：
- `POST /api/user/email` `{ email }`
- `POST /api/user/password` `{ old_password, new_password }`

管理员（需管理员）：
- `GET /api/admin/users?q=&limit=&offset=`
- `PATCH /api/admin/users/:id` `{ status?, email? }`
- `DELETE /api/admin/users/:id`（软删除）
- `GET /api/admin/login-logs?limit=`

业务：
- `POST /api/answer`
- `WS /ws/asr`

