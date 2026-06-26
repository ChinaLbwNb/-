# AI Tool for Interview - Configuration Guide

## 🔒 安全提示

**重要**：本项目包含多个配置文件，其中包含敏感信息。请勿将以下文件提交到版本控制系统：

- `server/config/asr_config.json` - 讯飞 ASR 配置
- `server/config/prompt_config.json` - AI 模型配置
- `server/config/payment_config.json` - 支付宝配置

## 📋 配置步骤

### 1. 复制配置文件模板

```bash
# ASR 配置
cp server/config/asr_config.example.json server/config/asr_config.json

# AI 模型配置
cp server/config/prompt_config.example.json server/config/prompt_config.json

# 支付宝配置
cp server/config/payment_config.example.json server/config/payment_config.json
```

### 2. 编辑配置文件

#### 讯飞 ASR 配置 (`server/config/asr_config.json`)

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

[获取讯飞 API Key](https://www.xfyun.cn/services/iat)

#### AI 模型配置 (`server/config/prompt_config.json`)

```json
{
  "api_base": "https://api.openai.com/v1",
  "api_key": "你的API Key",
  "model": "gpt-3.5-turbo",
  "system_prompt": "你是一个面试助手...",
  "task": "根据问题，结合简历与项目经历，给出简洁、专业的回答。"
}
```

[获取 OpenAI API Key](https://platform.openai.com/account/api-keys)

#### 支付宝配置 (`server/config/payment_config.json`)

```json
{
  "alipay": {
    "app_id": "支付宝应用ID",
    "private_key": "应用私钥",
    "public_key": "支付宝公钥",
    "notify_url": "https://yourdomain.com/api/payment/alipay/notify",
    "return_url": "https://yourdomain.com/recharge"
  }
}
```

### 3. 验证配置

```bash
# 确认 .gitignore 包含敏感文件
cat .gitignore | grep -E "config\.json"

# 检查 Git 状态
git status

# 不应该显示以下文件：
# server/config/asr_config.json
# server/config/prompt_config.json
# server/config/payment_config.json
```

## 🚀 启动应用

```bash
# 安装依赖
npm install

# 启动服务
npm run server

# 访问应用
# http://localhost:8000
```

## 📚 更多信息

详见 [README.md](./README.md) 了解更多项目信息。