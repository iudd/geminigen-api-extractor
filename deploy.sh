#!/bin/bash

# MindVideo 2 API - Cloudflare Workers 自动部署脚本

echo "🚀 MindVideo 2 API - Cloudflare Workers 部署脚本"
echo "=================================================="

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler 未安装，请先运行: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
echo "🔐 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "📋 请登录到 Cloudflare:"
    wrangler auth login
fi

# 检查环境变量
echo "🔑 设置 AUTH_TOKENS 环境变量..."
echo "请输入你的 MindVideo Token(s)，多个Token用逗号分隔:"
echo "格式示例: eyJ0eXAiOiJKV1Qi... , eyJ0eXAiOiJKV1Qi..."
read -p "Token(s): " tokens

if [ -z "$tokens" ]; then
    echo "❌ Token 不能为空"
    exit 1
fi

# 转换为JSON数组格式
token_array="[\"${tokens//,/\",\"}\"]"
echo "设置 Token: $token_array"

# 设置环境变量
echo "$token_array" | wrangler secret put AUTH_TOKENS

if [ $? -ne 0 ]; then
    echo "❌ 设置环境变量失败"
    exit 1
fi

# 部署
echo "🚀 开始部署到 Cloudflare Workers..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo ""
    echo "📋 使用说明:"
    echo "1. 复制上面显示的 Worker URL"
    echo "2. 使用 OpenAI 兼容接口:"
    echo "   curl -X POST \"YOUR_WORKER_URL/v1/chat/completions\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"messages\": [{\"role\": \"user\", \"content\": \"生成图片\"}]}'"
    echo ""
    echo "3. 或使用 MindVideo 原生接口:"
    echo "   curl -X POST \"YOUR_WORKER_URL/api/creations\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"prompt\": \"生成图片\"}'"
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi