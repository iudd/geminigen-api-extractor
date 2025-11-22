// ==UserScript==
// @name         GeminiGen API Extractor
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Extract API information and token from geminigen.ai/app/video-gen for curl/API usage
// @author       iudd
// @match        https://geminigen.ai/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式 (参考MindVideo脚本)
    GM_addStyle(`
        .geminigen-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 520px;
            max-height: 85vh;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            border-radius: 10px;
            padding: 15px;
            z-index: 10000;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.6);
            overflow-y: auto;
            overflow-x: hidden;
            border: 1px solid #333;
        }
        .panel-header {
            font-weight: bold;
            font-size: 17px;
            margin-bottom: 12px;
            color: #4CAF50;
            border-bottom: 2px solid #555;
            padding-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .panel-section {
            margin: 12px 0;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid #444;
            border-radius: 6px;
            padding: 12px;
        }
        .panel-section h4 {
            margin: 0 0 10px 0;
            color: #81c784;
            font-size: 15px;
            font-weight: bold;
        }
        .info-content {
            max-height: 220px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.4);
            padding: 10px;
            border-radius: 4px;
            font-size: 11px;
            border: 1px solid #666;
        }
        .info-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
            color: #e8f5e8;
            line-height: 1.4;
        }
        .copy-btn, .clear-btn, .refresh-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px 5px 5px 0;
            font-size: 11px;
            font-weight: bold;
            transition: all 0.2s;
        }
        .copy-btn:hover {
            background: #45a049;
        }
        .clear-btn {
            background: #f44336;
        }
        .clear-btn:hover {
            background: #d32f2f;
        }
        .refresh-btn {
            background: #2196F3;
        }
        .refresh-btn:hover {
            background: #1976D2;
        }
        .toggle-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            width: 55px;
            height: 55px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10001;
            font-size: 24px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
            transition: all 0.3s;
        }
        .toggle-btn:hover {
            transform: scale(1.1);
        }
        .close-btn {
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            font-weight: bold;
        }
        .close-btn:hover {
            background: #ff2222;
        }
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
            background: #4CAF50;
        }
        .status-indicator.active {
            background: #ff9800;
        }
        .no-data {
            color: #888;
            font-style: italic;
            padding: 15px;
            text-align: center;
        }
        .token-highlight {
            background: #4CAF50;
            color: black;
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: bold;
        }
    `);

    // 全局变量
    let currentPanel = null;
    let capturedRequests = [];
    let capturedTokens = [];
    let originalFetch = null;
    let originalXHR = null;
    let isInterceptionActive = false;

    // 提取页面信息
    function extractPageInfo() {
        const info = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toLocaleString()
        };

        // 提取输入框 (文生视频提示词)
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
            if (input.value && input.value.trim().length > 3) {
                info[input.name || input.id || 'prompt'] = input.value.trim();
            }
        });

        // 提取尺寸/分辨率选择
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            if (select.value) {
                info[select.name || select.id || 'size'] = select.value;
            }
        });

        // 提取按钮
        const buttons = document.querySelectorAll('button');
        info.buttons = Array.from(buttons).map(btn => ({
            text: btn.textContent?.trim(),
            class: btn.className,
            id: btn.id
        }));

        return info;
    }

    // 提取视频链接
    function extractVideoLinks() {
        const links = [];
        document.querySelectorAll('video source, video[src], a[href*="mp4"], a[href*="video"]').forEach(el => {
            const url = el.src || el.href;
            if (url) links.push(url);
        });
        return links;
    }

    // 拦截网络请求
    function startInterception() {
        if (isInterceptionActive) return;
        isInterceptionActive = true;

        // Fetch拦截
        originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            const urlStr = typeof url === 'string' ? url : url.href;
            const method = options.method || 'GET';
            const headers = options.headers || {};
            const body = options.body;

            // 捕获所有POST/PUT请求和包含关键词的请求
            if (method !== 'GET' || urlStr.includes('/api/') || urlStr.includes('generate') || urlStr.includes('video') || urlStr.includes('create')) {
                const requestInfo = {
                    method,
                    url: urlStr,
                    headers,
                    body: body ? (typeof body === 'string' ? body : await body.text()) : null,
                    timestamp: new Date().toLocaleString()
                };

                // 提取Token
                const authHeader = headers.authorization || headers.Authorization;
                if (authHeader && authHeader.includes('Bearer ')) {
                    const token = authHeader.replace('Bearer ', '');
                    capturedTokens.push({ token, url: urlStr, timestamp: new Date().toLocaleString() });
                }

                capturedRequests.push(requestInfo);
                console.log('📡 捕获请求:', method, urlStr.substring(0, 100));
                updatePanel();
            }

            return originalFetch.apply(this, args);
        };

        // XHR拦截
        originalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open.bind(xhr);
            const originalSend = xhr.send.bind(xhr);

            let requestInfo = {};

            xhr.open = function(method, url, ...args) {
                requestInfo = { method, url, headers: {}, timestamp: new Date().toLocaleString() };
                originalOpen(method, url, ...args);
            };

            xhr.setRequestHeader = function(key, value) {
                requestInfo.headers[key] = value;
                xhr.setRequestHeader(key, value);
            };

            xhr.send = function(body) {
                requestInfo.body = body;

                if (requestInfo.method !== 'GET' || requestInfo.url.includes('/api/') || requestInfo.url.includes('generate')) {
                    // 提取Token
                    const authHeader = requestInfo.headers.authorization || requestInfo.headers.Authorization;
                    if (authHeader && authHeader.includes('Bearer ')) {
                        const token = authHeader.replace('Bearer ', '');
                        capturedTokens.push({ token, url: requestInfo.url, timestamp: new Date().toLocaleString() });
                    }

                    capturedRequests.push(requestInfo);
                    console.log('📡 XHR捕获:', requestInfo.method, requestInfo.url);
                    updatePanel();
                }

                originalSend(body);
            };

            return xhr;
        };
    }

    // 生成Curl命令
    function generateCurl(request) {
        let curl = `curl -X ${request.method} "${request.url}"`;
        Object.entries(request.headers).forEach(([key, value]) => {
            curl += ` -H "${key}: ${value}"`;
        });
        if (request.body) curl += ` -d '${request.body.replace(/'/g, "'\\''")}'`;
        return curl;
    }

    // 复制功能
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('已复制！');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = 0;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showNotification('已复制！');
        });
    }

    // 显示通知
    function showNotification(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:10px 20px;border-radius:5px;z-index:10001;font-weight:bold;';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    }

    // 更新面板
    function updatePanel() {
        if (!currentPanel) return;

        const pageInfo = extractPageInfo();
        const videoLinks = extractVideoLinks();

        let html = `
            <div class="panel-header">
                🎯 GeminiGen API提取器 v1.0
                <button class="close-btn" onclick="this.closest('.geminigen-panel').remove();">×</button>
            </div>
        `;

        // 页面信息
        html += `
            <div class="panel-section">
                <h4>📄 页面信息</h4>
                <div class="info-content"><pre>${JSON.stringify(pageInfo, null, 2)}</pre></div>
                <button class="copy-btn" onclick="copyToClipboard(JSON.stringify(${JSON.stringify(pageInfo)}, null, 2))">复制</button>
            </div>
        `;

        // Token列表
        html += `
            <div class="panel-section">
                <h4>🔑 捕获的Token (${capturedTokens.length})</h4>
                <div class="info-content">
                    ${capturedTokens.map(t => `<div><strong>Token:</strong> <span class="token-highlight">${t.token.substring(0, 50)}...</span> <small>${t.url.substring(0, 50)}...</small></div>`).join('') || '暂无Token'}
                </div>
                <button class="copy-btn" onclick="copyToClipboard('${capturedTokens.map(t => t.token).join('\\n')}')">复制所有Token</button>
            </div>
        `;

        // API请求
        html += `
            <div class="panel-section">
                <h4>📡 API请求 (${capturedRequests.length})</h4>
                <div class="info-content"><pre>${JSON.stringify(capturedRequests.slice(-10), null, 2)}</pre></div>
                <button class="copy-btn" onclick="copyToClipboard(JSON.stringify(${JSON.stringify(capturedRequests.slice(-10))}, null, 2))">复制</button>
            </div>
        `;

        // Curl命令
        if (capturedRequests.length > 0) {
            html += '<div class="panel-section"><h4>🔧 Curl命令</h4>';
            capturedRequests.slice(-5).forEach((req, i) => {
                const curl = generateCurl(req);
                html += `<div class="info-content"><pre>${curl}</pre><button class="copy-btn" onclick="copyToClipboard('${curl.replace(/'/g, "\\'")}')">复制</button></div>`;
            });
            html += '</div>';
        }

        // 视频链接
        html += `
            <div class="panel-section">
                <h4>🎬 视频链接 (${videoLinks.length})</h4>
                <div class="info-content"><pre>${JSON.stringify(videoLinks, null, 2)}</pre></div>
                <button class="copy-btn" onclick="copyToClipboard('${videoLinks.join('\\n')}')">复制</button>
            </div>
        `;

        // 操作按钮
        html += `
            <div class="panel-section">
                <button class="copy-btn" onclick="startInterception()">开始拦截</button>
                <button class="clear-btn" onclick="capturedRequests=[];capturedTokens=[];updatePanel()">清空</button>
                <button class="refresh-btn" onclick="updatePanel()">刷新</button>
            </div>
        `;

        currentPanel.innerHTML = html;
    }

    // 创建面板
    function createPanel() {
        if (currentPanel) {
            currentPanel.remove();
            currentPanel = null;
            return;
        }

        currentPanel = document.createElement('div');
        currentPanel.className = 'geminigen-panel';
        document.body.appendChild(currentPanel);
        startInterception();
        updatePanel();
        setInterval(updatePanel, 2000);
    }

    // 创建切换按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = '🔍';
    toggleBtn.title = 'GeminiGen API提取器';
    toggleBtn.onclick = createPanel;
    document.body.appendChild(toggleBtn);

    console.log('🔍 GeminiGen API提取器已加载');
})();