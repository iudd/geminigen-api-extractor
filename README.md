# GeminiGen API Extractor

油猴脚本，用于提取 https://geminigen.ai/app/video-gen 的API信息和Token。

## 功能特性

- 🔑 **Token自动提取** - 捕获Authorization Bearer Token
- 📡 **API请求拦截** - 捕获文生视频API调用
- 🎬 **视频链接检测** - 自动查找生成的视频URL
- 🔧 **Curl命令生成** - 提供可直接使用的curl命令
- 📄 **页面信息提取** - 提示词、尺寸、按钮等信息

## 使用方法

1. 安装Tampermonkey浏览器扩展
2. 创建新脚本，复制代码
3. 访问 https://geminigen.ai/app/video-gen
4. 点击🔍按钮打开提取面板
5. 输入提示词，选择尺寸，点击生成
6. 查看捕获的Token和API信息

## 下载

[直接下载脚本](https://raw.githubusercontent.com/iudd/geminigen-api-extractor/main/geminigen_api_extractor.user.js)