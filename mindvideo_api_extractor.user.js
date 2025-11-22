// ==UserScript==
// @name         MindVideo API Extractor
// @namespace    http://tampermonkey.net/
// @version      2.5.2
// @description  Extract API information and token from mindvideo.ai - Enhanced Creation/Refresh Detection + All Headers
// @author       iudd
// @match        https://www.mindvideo.ai/*
// @match        https://mindvideo.ai/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .mindvideo-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 560px;
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
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px 5px 5px 0;
            font-size: 12px;
            font-weight: bold;
            transition: all 0.2s;
            min-height: 35px;
        }
        .copy-btn:hover {
            background: #45a049;
        }
        .copy-btn.copying {
            background: #ff9800;
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
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
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10001;
            font-size: 26px;
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
            width: 26px;
            height: 26px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            font-weight: bold;
        }
        .close-btn:hover {
            background: #ff2222;
        }
        .notification {
            position: fixed;
            top: 80px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10002;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            max-width: 320px;
            line-height: 1.4;
        }
        .notification.error {
            background: #f44336;
        }
        .cleared-state {
            color: #ff9800;
            font-style: italic;
        }
        .storage-section {
            background: rgba(255, 193, 7, 0.1);
            border-color: #ffc107;
        }
        .refresh-section {
            background: rgba(33, 150, 243, 0.1);
            border-color: #2196F3;
            border-left: 4px solid #2196F3;
        }
        .creation-section {
            background: rgba(76, 175, 80, 0.1);
            border-color: #4CAF50;
            border-left: 4px solid #4CAF50;
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
            font-family: monospace;
        }
        .method-post {
            color: #81c784;
            font-weight: bold;
        }
        .method-get {
            color: #ffb74d;
            font-weight: bold;
        }
        .refresh-highlight {
            background: rgba(33, 150, 243, 0.2);
            border-left: 3px solid #2196F3;
            padding: 8px;
            margin: 5px 0;
        }
        .creation-highlight {
            background: rgba(76, 175, 80, 0.2);
            border-left: 3px solid #4CAF50;
            padding: 8px;
            margin: 5px 0;
        }
        .copy-display {
            position: fixed;
            top: 120px;
            left: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.95);
            color: #4CAF50;
            padding: 15px;
            border-radius: 8px;
            z-index: 10003;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            max-height: 200px;
            overflow-y: auto;
            border: 2px solid #4CAF50;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: none;
        }
        .copy-display.show {
            display: block;
        }
        .copy-display::before {
            content: "📋 长按下方内容全选复制：";
            display: block;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .token-count {
            background: rgba(76, 175, 80, 0.2);
            color: #4CAF50;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 8px;
        }
        .instruction {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid #ffc107;
            border-radius: 6px;
            padding: 10px;
            margin: 10px 0;
            color: #ffeb3b;
            font-size: 12px;
        }
        .instruction strong {
            color: #ffc107;
        }
        .debug-info {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #666;
            border-radius: 4px;
            padding: 8px;
            margin: 8px 0;
            font-size: 11px;
            color: #ccc;
        }
    `);

    // 全局变量
    let currentPanel = null;
    let capturedRequests = [];
    let capturedTokens = [];
    let refreshTokens = []; // 专门存储refresh接口的Token
    let creationTokens = []; // 专门存储creation接口的Token
    let allHeaders = []; // 存储所有捕获的headers
    let originalFetch = null;
    let originalXHR = null;
    let isInterceptionActive = false;
    let isCleared = false;
    let copyDisplay = null; // 复制显示区域

    // 提取页面信息
    function extractPageInfo() {
        const info = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toLocaleString()
        };

        const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
        inputs.forEach(input => {
            if (input.value && input.value.trim().length > 2) {
                info[input.name || input.id || 'prompt'] = input.value.trim();
            }
        });

        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            if (select.value) {
                info[select.name || select.id || 'size'] = select.value;
            }
        });

        return info;
    }

    // 提取图片链接
    function extractImageLinks() {
        const links = [];
        document.querySelectorAll('img[src], a[href*=".jpg"], a[href*=".png"], a[href*=".webp"]').forEach(el => {
            const url = el.src || el.href;
            if (url && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp') || url.includes('mindvideo'))) {
                links.push(url);
            }
        });
        return links;
    }

    // 提取Storage中的Token - 增强版
    function extractFromStorage() {
        const tokens = [];
        Object.keys(localStorage).forEach(key => {
            if (key.includes('token') || key.includes('auth') || key.includes('session') || key.includes('mindvideo')) {
                tokens.push({
                    source: 'localStorage',
                    key,
                    value: localStorage[key].substring(0, 50) + '...',
                    full: localStorage[key]
                });
            }
        });
        document.cookie.split(';').forEach(cookie => {
            const [key, value] = cookie.trim().split('=');
            if (key.includes('token') || key.includes('session') || key.includes('auth')) {
                tokens.push({
                    source: 'Cookie',
                    key,
                    value: value.substring(0, 50) + '...',
                    full: value
                });
            }
        });
        return tokens;
    }

    // 超级增强复制功能 - 移动端终极兼容
    async function copyToClipboard(text, btn = null, description = '数据') {
        console.log(`🔄 复制${description}:`, text.substring(0, 100) + '...');

        // 创建复制显示区域（如果不存在）
        if (!copyDisplay) {
            copyDisplay = document.createElement('div');
            copyDisplay.className = 'copy-display';
            document.body.appendChild(copyDisplay);
        }

        // 显示复制内容（无论是否复制成功，都显示让用户手动复制）
        copyDisplay.textContent = text;
        copyDisplay.classList.add('show');

        // 自动隐藏
        setTimeout(() => {
            if (copyDisplay) copyDisplay.classList.remove('show');
        }, 15000);

        // 尝试各种复制方法
        let copied = false;

        // 方法1: GM_setClipboard (Tampermonkey最可靠)
        if (typeof GM_setClipboard === 'function') {
            try {
                GM_setClipboard(text);
                showNotification(`✅ GM_setClipboard成功！\n上方绿色区域也已显示内容`);
                if (btn) btn.textContent = '已复制 ✓';
                copied = true;
            } catch (e) {
                console.log('GM_setClipboard失败:', e);
            }
        }

        // 方法2: navigator.clipboard
        if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                showNotification(`✅ Clipboard API成功！\n上方绿色区域也已显示内容`);
                if (btn) btn.textContent = '已复制 ✓';
                copied = true;
            } catch (e) {
                console.log('Clipboard API失败:', e);
            }
        }

        // 方法3: textarea + execCommand
        if (!copied) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-999999px';
                ta.style.top = '-999999px';
                ta.style.opacity = '0';
                ta.style.width = '1px';
                ta.style.height = '1px';
                ta.style.padding = '0';
                ta.style.border = 'none';
                ta.style.outline = 'none';
                ta.style.resize = 'none';
                document.body.appendChild(ta);

                ta.focus();
                ta.select();
                ta.setSelectionRange(0, text.length);

                const successful = document.execCommand('copy');
                document.body.removeChild(ta);

                if (successful) {
                    showNotification(`✅ 兼容模式成功！\n上方绿色区域也已显示内容`);
                    if (btn) btn.textContent = '已复制 ✓';
                    copied = true;
                }
            } catch (e) {
                console.log('execCommand失败:', e);
            }
        }

        // 如果所有方法都失败，只显示绿色区域
        if (!copied) {
            showNotification('📱 请长按上方绿色区域全选复制！');
            if (btn) btn.textContent = '请手动复制';
        }

        return copied;
    }

    // 通知
    function showNotification(msg, isError = false) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.className = `notification ${isError ? 'error' : ''}`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }

    // 拦截网络请求 - 专门针对creation/refresh接口增强版
    function startInterception() {
        if (isInterceptionActive) return;
        isInterceptionActive = true;
        console.log('🕸️ 开始拦截MindVideo请求，重点关注creation/refresh接口...');

        originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            const urlStr = typeof url === 'string' ? url : url.href;
            const method = options.method || 'GET';
            const headers = options.headers || {};
            let bodyStr = null;

            if (options.body) {
                if (typeof options.body === 'string') bodyStr = options.body;
                else if (options.body.text) bodyStr = await options.body.text();
            }

            // 重点捕获MindVideo相关请求，特别是creation/refresh
            if (urlStr.includes('mindvideo.ai') || urlStr.includes('mindvideo')) {
                const requestInfo = {
                    method,
                    url: urlStr,
                    headers: { ...headers },
                    body: bodyStr,
                    timestamp: new Date().toLocaleString(),
                    isCreation: urlStr.includes('creation') || urlStr.includes('/api/v2/creations'),
                    isRefresh: urlStr.includes('refresh') || urlStr.includes('/api/v2/refresh')
                };

                // 捕获所有headers
                allHeaders.push({
                    url: urlStr,
                    method,
                    headers: { ...headers },
                    timestamp: new Date().toLocaleString(),
                    isCreation: requestInfo.isCreation,
                    isRefresh: requestInfo.isRefresh
                });

                // 增强Token捕获 - 所有可能的header和值
                Object.keys(headers).forEach(key => {
                    const value = headers[key];
                    const isTokenLike = value && (
                        value.includes('Bearer ') ||
                        key.toLowerCase().includes('token') ||
                        key.toLowerCase().includes('auth') ||
                        key.toLowerCase().includes('session') ||
                        key.toLowerCase().includes('x-auth') ||
                        key.toLowerCase().includes('authorization') ||
                        value.includes('eyJ') ||
                        value.match(/[!#\$%^&*]{2,}/) ||
                        value.length > 20 ||
                        value.match(/^[A-Za-z0-9+/=]{20,}$/)
                    );

                    if (isTokenLike) {
                        const tokenInfo = {
                            source: 'Header',
                            key,
                            value: value.substring(0, 50) + '...',
                            full: value,
                            url: urlStr,
                            isCreation: requestInfo.isCreation,
                            isRefresh: requestInfo.isRefresh,
                            timestamp: new Date().toLocaleString()
                        };

                        capturedTokens.push(tokenInfo);

                        // 专门存储creation接口的Token
                        if (requestInfo.isCreation) {
                            creationTokens.push(tokenInfo);
                            console.log('🎯 捕获到Creation接口Token:', key, '=', value.substring(0, 20) + '...');
                        }

                        // 专门存储refresh接口的Token
                        if (requestInfo.isRefresh) {
                            refreshTokens.push(tokenInfo);
                            console.log('🎯 捕获到Refresh接口Token:', key, '=', value.substring(0, 20) + '...');
                        }
                    }
                });

                capturedRequests.push(requestInfo);
                updatePanel();
            }

            return originalFetch.apply(this, args);
        };

        // XHR拦截 - 也重点关注creation/refresh
        if (window.XMLHttpRequest) {
            originalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                let requestInfo = {};

                const originalOpen = xhr.open;
                xhr.open = function(method, url, ...args) {
                    if (url && (url.includes('mindvideo') || url.includes('creation') || url.includes('refresh'))) {
                        requestInfo = {
                            method,
                            url,
                            headers: {},
                            timestamp: new Date().toLocaleString(),
                            isCreation: url.includes('creation') || url.includes('/api/v2/creations'),
                            isRefresh: url.includes('refresh') || url.includes('/api/v2/refresh')
                        };
                    }
                    originalOpen.apply(this, arguments);
                };

                const originalSetHeader = xhr.setRequestHeader;
                xhr.setRequestHeader = function(key, value) {
                    if (requestInfo.url) {
                        requestInfo.headers[key] = value;

                        // XHR中也捕获Token
                        const isTokenLike = value && (
                            value.includes('Bearer ') ||
                            key.toLowerCase().includes('token') ||
                            key.toLowerCase().includes('auth') ||
                            key.toLowerCase().includes('authorization') ||
                            value.includes('eyJ') ||
                            value.match(/[!#\$%^&*]{2,}/) ||
                            value.length > 20 ||
                            value.match(/^[A-Za-z0-9+/=]{20,}$/)
                        );

                        if (isTokenLike) {
                            const tokenInfo = {
                                source: 'XHR Header',
                                key,
                                value: value.substring(0, 50) + '...',
                                full: value,
                                url: requestInfo.url,
                                isCreation: requestInfo.isCreation,
                                isRefresh: requestInfo.isRefresh,
                                timestamp: new Date().toLocaleString()
                            };

                            capturedTokens.push(tokenInfo);
                            if (requestInfo.isCreation) {
                                creationTokens.push(tokenInfo);
                                console.log('🎯 XHR捕获到Creation接口Token:', key, '=', value.substring(0, 20) + '...');
                            }
                            if (requestInfo.isRefresh) {
                                refreshTokens.push(tokenInfo);
                                console.log('🎯 XHR捕获到Refresh接口Token:', key, '=', value.substring(0, 20) + '...');
                            }
                        }
                    }
                    originalSetHeader.call(this, key, value);
                };

                const originalSend = xhr.send;
                xhr.send = function(body) {
                    if (requestInfo.url) {
                        requestInfo.body = body;
                        capturedRequests.push(requestInfo);
                        updatePanel();
                    }
                    originalSend.call(this, body);
                };

                return xhr;
            };
        }
    }

    // 停止拦截
    function stopInterception() {
        if (!isInterceptionActive) return;
        isInterceptionActive = false;
        if (originalFetch) window.fetch = originalFetch;
        if (originalXHR) window.XMLHttpRequest = originalXHR;
        console.log('🛑 拦截已停止');
    }

    // 生成Curl
    function generateCurl(request) {
        let curl = `curl -X ${request.method} "${request.url}"`;
        Object.entries(request.headers || {}).forEach(([key, value]) => {
            curl += ` \\\n  -H "${key}: ${value}"`;
        });
        if (request.body) curl += ` \\\n  -d '${request.body.replace(/'/g, "'\\''")}'`;
        return curl;
    }

    // 按钮事件处理
    function handleButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        btn.classList.add('copying');
        console.log('按钮点击:', action);

        let text = '';
        let description = '数据';

        switch (action) {
            case 'copy-page':
                text = JSON.stringify(extractPageInfo(), null, 2);
                description = '页面信息';
                copyToClipboard(text, btn, description);
                break;
            case 'copy-tokens':
                text = capturedTokens.map(t => `${t.source}.${t.key}:\n${t.full}\n`).join('\n\n');
                description = '所有Token';
                copyToClipboard(text, btn, description);
                break;
            case 'copy-creation-tokens':
                text = creationTokens.map(t => `${t.source}.${t.key}:\n${t.full}\n`).join('\n\n');
                description = 'Creation Token';
                copyToClipboard(text, btn, description);
                break;
            case 'copy-refresh-tokens':
                text = refreshTokens.map(t => `${t.source}.${t.key}:\n${t.full}\n`).join('\n\n');
                description = 'Refresh Token';
                copyToClipboard(text, btn, description);
                break;
            case 'copy-all-headers':
                text = allHeaders.map(h => `URL: ${h.url}\nMethod: ${h.method}\nHeaders:\n${JSON.stringify(h.headers, null, 2)}\n`).join('\n---\n');
                description = '所有Headers';
                copyToClipboard(text, btn, description);
                break;
            case 'copy-requests':
                text = JSON.stringify(capturedRequests.slice(-5), null, 2);
                description = '请求详情';
                copyToClipboard(text, btn, description);
                break;
            case 'copy-images':
                text = extractImageLinks().join('\n');
                description = '图片链接';
                copyToClipboard(text, btn, description);
                break;
            case 'clear':
                capturedRequests = [];
                capturedTokens = [];
                refreshTokens = [];
                creationTokens = [];
                allHeaders = [];
                isCleared = true;
                console.log('清空成功');
                showNotification('✅ 已清空所有数据！\n重新生成查看新数据');
                updatePanel();
                btn.classList.remove('copying');
                break;
            case 'refresh':
                updatePanel();
                showNotification('🔄 已刷新面板');
                btn.classList.remove('copying');
                break;
        }
    }

    // 添加事件监听
    function addButtonListeners() {
        if (!currentPanel) return;
        const container = currentPanel;
        container.addEventListener('click', handleButtonClick, true);
        container.addEventListener('touchend', handleButtonClick, { passive: false });
    }

    // 更新面板
    function updatePanel() {
        if (!currentPanel) return;

        const pageInfo = extractPageInfo();
        const imageLinks = extractImageLinks();
        const storageTokens = extractFromStorage();
        const allTokens = [...capturedTokens, ...storageTokens];

        let html = `
            <div class="panel-header">
                🎯 MindVideo API提取器 v2.5.2
                <button class="close-btn" onclick="this.closest('.mindvideo-panel').remove();stopInterception();">×</button>
            </div>

            <div class="instruction">
                <strong>📋 Token获取步骤：</strong><br>
                1. 访问 https://www.mindvideo.ai/zh/text-to-image/<br>
                2. 登录账号，输入提示词<br>
                3. 点击"生成"按钮<br>
                4. 脚本自动捕获Creation/Refresh接口的所有Token
            </div>

            <div class="debug-info">
                调试信息: 请求数=${capturedRequests.length}, Token数=${allTokens.length}, Headers数=${allHeaders.length}
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📄 页面信息</h4>
                <div class="info-content"><pre>${JSON.stringify(pageInfo, null, 2)}</pre></div>
                <button class="copy-btn" data-action="copy-page">复制页面信息</button>
            </div>
        `;

        // Creation Token 专门区域
        html += `
            <div class="panel-section creation-section">
                <h4>🔑 Creation Token (${creationTokens.length}) <span class="token-count">重点</span></h4>
                <div class="info-content">
                    ${creationTokens.length > 0 ? creationTokens.slice(-8).map(t => `
                        <div class="creation-highlight">
                            <strong>${t.source}:</strong> <span class="token-highlight">${t.value}</span><br>
                            <small>🆕 Creation接口 | ${t.key} | ${t.timestamp}</small>
                        </div>
                    `).join('') : '<div class="no-data">暂无Creation Token<br>请点击"生成"触发creation接口<br>脚本会自动捕获所有Token</div>'}
                </div>
                ${creationTokens.length > 0 ? '<button class="copy-btn" data-action="copy-creation-tokens">复制Creation Token</button>' : ''}
            </div>
        `;

        // Refresh Token 区域
        html += `
            <div class="panel-section refresh-section">
                <h4>🔄 Refresh Token (${refreshTokens.length})</h4>
                <div class="info-content">
                    ${refreshTokens.length > 0 ? refreshTokens.slice(-8).map(t => `
                        <div class="refresh-highlight">
                            <strong>${t.source}:</strong> <span class="token-highlight">${t.value}</span><br>
                            <small>🔄 Refresh接口 | ${t.key} | ${t.timestamp}</small>
                        </div>
                    `).join('') : '<div class="no-data">暂无Refresh Token<br>请等待生成完成触发refresh接口</div>'}
                </div>
                ${refreshTokens.length > 0 ? '<button class="copy-btn" data-action="copy-refresh-tokens">复制Refresh Token</button>' : ''}
            </div>
        `;

        html += `
            <div class="panel-section storage-section">
                <h4>📦 所有Token (${allTokens.length})</h4>
                <div class="info-content">
                    ${allTokens.length > 0 ? allTokens.slice(-5).map(t => `
                        <div>
                            <strong>${t.source}:</strong> <span class="token-highlight">${t.value}</span><br>
                            <small>${t.key} | ${t.url?.substring(0, 60) || ''}</small>
                        </div>
                    `).join('<hr>') : '<div class="no-data">暂无Token</div>'}
                </div>
                ${allTokens.length > 0 ? '<button class="copy-btn" data-action="copy-tokens">复制所有Token</button><button class="copy-btn" data-action="copy-all-headers">复制所有Headers</button>' : ''}
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📡 API请求 (${capturedRequests.length})</h4>
                <div class="info-content">
                    ${capturedRequests.length > 0 ? capturedRequests.slice(-5).map(req => `
                        <div style="margin-bottom: 8px;">
                            <span class="${req.isCreation ? 'creation-highlight' : req.isRefresh ? 'refresh-highlight' : ''}" style="display: inline-block; padding: 2px 6px; border-radius: 3px;">
                                <span class="method-${req.method.toLowerCase()}">${req.method}</span>
                                ${req.isCreation ? '🆕' : req.isRefresh ? '🔄' : ''} ${req.url.split('/').pop()}
                            </span><br>
                            <small>${req.url}</small>
                        </div>
                    `).join('') : '<div class="no-data">暂无请求 - 点击生成</div>'}
                </div>
                ${capturedRequests.length > 0 ? '<button class="copy-btn" data-action="copy-requests">复制请求详情</button>' : ''}
            </div>
        `;

        if (capturedRequests.length > 0) {
            html += `
                <div class="panel-section">
                    <h4>🔧 Curl命令 (最新3个)</h4>
                    ${capturedRequests.slice(-3).map(req => `<div class="info-content"><pre>${generateCurl(req)}</pre></div>`).join('')}
                </div>
            `;
        }

        html += `
            <div class="panel-section">
                <h4>🖼️ 图片链接 (${imageLinks.length})</h4>
                <div class="info-content">
                    ${isCleared ? '<div class="cleared-state no-data">✅ 已清空！图片从页面DOM实时提取，重新生成查看新图片</div>' :
                    (imageLinks.length > 0 ? imageLinks.map(link => `<div>${link}</div>`).join('') : '<div class="no-data">暂无图片 - 生成完成后显示</div>')}
                </div>
                ${imageLinks.length > 0 ? '<button class="copy-btn" data-action="copy-images">复制图片链接</button>' : ''}
            </div>
        `;

        html += `
            <div class="panel-section">
                <button class="refresh-btn" data-action="refresh">🔄 刷新面板</button>
                <button class="clear-btn" data-action="clear">🗑️ 清空数据</button>
            </div>
        `;

        currentPanel.innerHTML = html;
        addButtonListeners();
        isCleared = false;
    }

    // 创建面板
    function createPanel() {
        if (currentPanel) {
            currentPanel.remove();
            currentPanel = null;
            stopInterception();
            return;
        }

        currentPanel = document.createElement('div');
        currentPanel.className = 'mindvideo-panel';
        document.body.appendChild(currentPanel);
        startInterception();
        updatePanel();
        setInterval(updatePanel, 2000);
    }

    // 创建切换按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = '🎨';
    toggleBtn.title = 'MindVideo API提取器 v2.5.2 - Creation/Refresh接口Token重点监控';
    toggleBtn.onclick = createPanel;
    toggleBtn.addEventListener('touchstart', createPanel, { passive: false });
    document.body.appendChild(toggleBtn);

    console.log('🎨 MindVideo API提取器 v2.5.2 已加载 - Creation/Refresh接口Token重点提取 + 完整Headers捕获');
    window.mindvideoDebug = { update: updatePanel, copy: copyToClipboard, tokens: () => ({creation: creationTokens, refresh: refreshTokens, all: capturedTokens}) };
})();