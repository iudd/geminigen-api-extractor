# MindVideo 2 API - Cloudflare Workers 部署指南

## 🚀 快速部署

### 1. 克隆仓库
```bash
git clone https://github.com/iudd/geminigen-api-extractor.git
cd geminigen-api-extractor
```

### 2. 安装依赖
```bash
npm install
```

### 3. 登录 Cloudflare
```bash
npx wrangler auth login
```

### 4. 设置环境变量
```bash
# 设置你的MindVideo Token（多个Token用逗号分隔）
npx wrangler secret put AUTH_TOKENS
# 输入: ["你的token1","你的token2"]
```

### 5. 部署到 Cloudflare Workers
```bash
npx wrangler deploy
```

## 🔧 配置说明

### wrangler.json 配置
```json
{
  "name": "mindvideo-2api-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-11-22",
  "compatibility_flags": ["nodejs_compat"]
}
```

### 环境变量
- `AUTH_TOKENS`: MindVideo API Token 数组，格式: `["token1","token2"]`

## 📡 API 使用

### OpenAI 兼容接口
```bash
curl -X POST "https://你的worker域名/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "生成一张美丽的风景图片"
      }
    ]
  }'
```

### MindVideo 原生接口
```bash
curl -X POST "https://你的worker域名/api/creations" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "生成一张美丽的风景图片"
  }'
```

## 🛠️ 本地开发

### 启动开发服务器
```bash
npm run dev
```

### 构建测试
```bash
npm run build
```

## 🔍 故障排除

### 常见错误

1. **"Missing entry-point" 错误**
   - 确保 `src/index.ts` 文件存在
   - 检查 `wrangler.json` 中的 `main` 字段路径正确

2. **"AUTH_TOKENS not found" 错误**
   - 使用 `npx wrangler secret put AUTH_TOKENS` 设置环境变量
   - 格式必须是JSON数组: `["token1","token2"]`

3. **CORS 错误**
   - Worker 已配置 CORS，检查请求头是否正确

## 📝 获取 Token

使用仓库中的 `mindvideo_api_extractor.user.js` 油猴脚本：

1. 安装 Tampermonkey
2. 导入脚本
3. 访问 https://www.mindvideo.ai/zh/text-to-image/
4. 登录并生成图片
5. 点击脚本按钮查看捕获的Token

## 🌐 部署后的 URL

部署成功后，你会得到一个类似 `https://mindvideo-2api-worker.xxx.workers.dev` 的URL。

## 📊 监控

访问 `https://你的worker域名/health` 查看服务状态。

---

**注意**: 请确保你的 Cloudflare 账户有 Workers 的使用权限。