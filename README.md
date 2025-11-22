# MindVideo 2 API - Cloudflare Workers

将 MindVideo 转换为标准的 OpenAI API 服务，部署在 Cloudflare Workers 上。

## 🚀 快速部署

### 1. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler auth login
```

### 3. 设置环境变量
```bash
# 设置 MindVideo Token（多个Token用逗号分隔）
wrangler secret put AUTH_TOKENS
# 输入: ["eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."]
```

### 4. 部署
```bash
npm install
wrangler deploy
```

## 📋 API 使用

### OpenAI 兼容接口
```bash
curl -X POST "https://your-worker.workers.dev/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "生成一张美丽风景图片"}
    ]
  }'
```

### MindVideo 原生接口
```bash
curl -X POST "https://your-worker.workers.dev/api/creations" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "生成一张美丽风景图片"
  }'
```

## 🔧 本地开发

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建测试
npm run build
```

## 📁 项目结构

```
├── wrangler.json      # Cloudflare Workers 配置
├── package.json       # 项目依赖
├── src/
│   └── index.ts       # 主入口文件
└── mindvideo_api_extractor.user.js  # 浏览器脚本
```

## 🔑 获取 Token

使用浏览器脚本 `mindvideo_api_extractor.user.js` 获取 Token：

1. 安装 Tampermonkey 插件
2. 导入脚本
3. 访问 https://www.mindvideo.ai/zh/text-to-image/
4. 点击左上角 🎨 按钮
5. 输入提示词，点击生成
6. 查看脚本捕获的 Token
7. 复制 Token 到环境变量

## 🌐 部署后的 URL

部署成功后，你会得到一个类似这样的 URL：
```
https://mindvideo-2api-worker.your-subdomain.workers.dev
```

## 📊 功能特性

- ✅ OpenAI API 兼容
- ✅ MindVideo 原生 API 支持
- ✅ 多 Token 负载均衡
- ✅ 自动重试机制
- ✅ CORS 支持
- ✅ 健康检查接口

## 🔍 调试

```bash
# 查看日志
wrangler tail

# 健康检查
curl https://your-worker.workers.dev/health
```

## ⚠️ 注意事项

1. **Token 安全**：Token 存储在 Cloudflare Workers 的环境变量中，请妥善保管
2. **使用限制**：遵守 MindVideo 的使用条款
3. **费用**：Cloudflare Workers 有免费额度，超出后会产生费用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 🎨 浏览器脚本使用（获取Token）

油猴脚本，用于提取 https://www.mindvideo.ai 的API信息和Token。

### 功能特性

- 🔑 **Token自动提取** - 捕获Authorization Bearer Token
- 📡 **API请求拦截** - 捕获文生图API调用
- 🖼️ **图片链接检测** - 自动查找生成的图片URL
- 🔧 **Curl命令生成** - 提供可直接使用的curl命令
- 📄 **页面信息提取** - 提示词、尺寸等信息

### 使用方法

1. 安装Tampermonkey浏览器扩展
2. 创建新脚本，复制代码
3. 访问 https://www.mindvideo.ai/zh/text-to-image/
4. 点击左上角 🎨 按钮打开提取面板
5. 输入提示词，点击生成
6. 查看捕获的Token和API信息

### 下载

[直接下载脚本](https://raw.githubusercontent.com/iudd/geminigen-api-extractor/main/mindvideo_api_extractor.user.js)