// ==UserScript==
// @name         MindVideo API Extractor
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @description  Extract API information and token from mindvideo.ai for curl/API usage - Button Fixed + Enhanced Token Capture
// @author       iudd
// @match        https://www.mindvideo.ai/*
// @match        https://mindvideo.ai/*
// @grant        GM_addStyle
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
            width: 540px;
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
            font-family: monospace;
        }
        .api-endpoint {
            color: #64b5f6;
            font-weight: bold;
        }
        .method-post {
            color: #81c784;
            font-weight: bold;
        }
        .method-get {
            color: #ffb74d;
            font-weight: bold;
        }
        .storage-section {
            background: rgba(255, 193, 7, 0.1);
            border-color: #ffc107;
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

        const buttons = document.querySelectorAll('button, input[type="submit"]');
        info.buttons = Array.from(buttons).map(btn => ({
            text: btn.textContent?.trim() || btn.value?.trim(),
            class: btn.className,
            id: btn.id
        }));

        return info;
    }

    // 提取图片链接
    function extractImageLinks() {
        const links = [];
        document.querySelectorAll('img[src], a[href*=".jpg"], a[href*=".png"], a[href*=".webp"]').forEach(el => {
            const url = el.src || el.href;
            if (url && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp') || url.includes('cdn.mindvideo'))) {
                links.push(url);
            }
        });
        return links;
    }

    // 提取Storage中的Token
    function extractFromStorage() {
        const tokens = [];
        // localStorage
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
        // Cookie
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

    // 拦截网络请求 - 增强版
    function startInterception() {
        if (isInterceptionActive) return;
        isInterceptionActive = true;

        originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            const urlStr = typeof url === 'string' ? url : url.href;
            const method = options.method || 'GET';
            const headers = options.headers || {};
            let bodyStr = null;

            if (body = options.body) {
                if (typeof body === 'string') bodyStr = body;
                else if (body.text) bodyStr = await body.text();
            }

            // 捕获MindVideo所有相关请求
            if (urlStr.includes('mindvideo.ai') || urlStr.includes('mindvideo')) {
                const requestInfo = {
                    method,
                    url: urlStr,
                    headers: { ...headers },
                    body: bodyStr,
                    timestamp: new Date().toLocaleString()
                };

                // 增强Token捕获 - 所有可能的header
                Object.keys(headers).forEach(key => {
                    const value = headers[key];
                    if (value && (
                        value.includes('Bearer ') ||
                        key.toLowerCase().includes('token') ||
                        key.toLowerCase().includes('auth') ||
                        key.toLowerCase().includes('session') ||
                        value.includes('eyJ') || // JWT特征
                        value.match(/[!#\$%^&*]{2,}/) // 特殊字符Token
                    )) {
                        capturedTokens.push({
                            source: 'Header',
                            key,
                            value: value.substring(0, 50) + '...',
                            full: value,
                            url: urlStr,
                            timestamp: new Date().toLocaleString()
                        });
                    }
                });

                capturedRequests.push(requestInfo);
                updatePanel();
            }

            return originalFetch.apply(this, args);
        };

        // XHR拦截类似增强
        originalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            let requestInfo = {};

            const originalOpen = xhr.open;
            xhr.open = function(method, url, ...args) {
                requestInfo = { method, url, headers: {}, timestamp: new Date().toLocaleString() };
                originalOpen.call(xhr, method, url, ...args);
            };

            const originalSetHeader = xhr.setRequestHeader;
            xhr.setRequestHeader = function(key, value) {
                requestInfo.headers[key] = value;
                originalSetHeader.call(xhr, key, value);
            };

            const originalSend = xhr.send;
            xhr.send = function(body) {
                requestInfo.body = body;

                if (requestInfo.url.includes('mindvideo')) {
                    // 增强Token捕获
                    Object.keys(requestInfo.headers).forEach(key => {
                        const value = requestInfo.headers[key];
                        if (value && (
                            value.includes('Bearer ') ||
                            key.toLowerCase().includes('token') ||
                            key.toLowerCase().includes('auth') ||
                            value.includes('eyJ') ||
                            value.match(/[!#\$%^&*]{2,}/)
                        )) {
                            capturedTokens.push({
                                source: 'XHR Header',
                                key,
                                value: value.substring(0, 50) + '...',
                                full: value,
                                url: requestInfo.url,
                                timestamp: new Date().toLocaleString()
                            });
                        }
                    });

                    capturedRequests.push(requestInfo);
                    updatePanel();
                }

                originalSend.call(xhr, body);
            };

            return xhr;
        };
    }

    // 停止拦截
    function stopInterception() {
        if (!isInterceptionActive) return;
        isInterceptionActive = false;
        if (originalFetch) window.fetch = originalFetch;
        if (originalXHR) window.XMLHttpRequest = originalXHR;
    }

    // 生成Curl
    function generateCurl(request) {
        let curl = `curl -X ${request.method} "${request.url}"`;
        Object.entries(request.headers).forEach(([key, value]) => {
            curl += ` \\\n  -H "${key}: ${value}"`;
        });
        if (request.body) curl += ` \\\n  -d '${request.body.replace(/'/g, "'\\''")}'`;
        return curl;
    }

    // 复制
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => showNotification('已复制！')).catch(e => console.error(e));
    }

    // 通知
    function showNotification(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:12px;border-radius:6px;z-index:10002;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    }

    // 按钮事件处理
    function handleButtonClick(e) {
        const action = e.target.dataset.action;
        let text = '';

        switch (action) {
            case 'copy-page':
                text = JSON.stringify(extractPageInfo(), null, 2);
                break;
            case 'copy-tokens':
                text = capturedTokens.map(t => t.full).join('\\n');
                break;
            case 'copy-requests':
                text = JSON.stringify(capturedRequests.slice(-5), null, 2);
                break;
            case 'copy-images':
                text = extractImageLinks().join('\\n');
                break;
            case 'copy-storage':
                text = capturedTokens.filter(t => t.source !== 'Header').map(t => `${t.source}.${t.key}=${t.full}`).join('\\n');
                break;
            case 'clear':
                capturedRequests = [];
                capturedTokens = [];
                updatePanel();
                showNotification('已清空数据！');
                return;
            case 'refresh':
                updatePanel();
                return;
        }

        copyToClipboard(text);
    }

    // 添加按钮事件监听
    function addButtonListeners() {
        if (!currentPanel) return;
        currentPanel.querySelectorAll('[data-action]').forEach(btn => {
            btn.removeEventListener('click', handleButtonClick);
            btn.addEventListener('click', handleButtonClick);
        });
    }

    // 更新面板
    function updatePanel() {
        if (!currentPanel) return;

        const pageInfo = extractPageInfo();
        const imageLinks = extractImageLinks();
        const storageTokens = extractFromStorage();

        let html = `
            <div class="panel-header">
                🎯 MindVideo API提取器 v2.2
                <button class="close-btn" onclick="this.closest('.mindvideo-panel').remove();">×</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📄 页面信息</h4>
                <div class="info-content"><pre>${JSON.stringify(pageInfo, null, 2)}</pre></div>
                <button class="copy-btn" data-action="copy-page">复制</button>
            </div>
        `;

        // 增强Token部分
        const allTokens = [...capturedTokens, ...storageTokens];
        html += `
            <div class="panel-section storage-section">
                <h4>🔑 Token & Keys (${allTokens.length})</h4>
                <div class="info-content">
                    ${allTokens.length > 0 ? allTokens.slice(-10).map(t => `
                        <div>
                            <strong>${t.source}:</strong> <span class="token-highlight">${t.value}</span><br>
                            <small>${t.key || 'N/A'} | ${t.url || ''}</small>
                        </div>
                    `).join('<hr>') : '暂无 - 生成图片后自动捕获'}
                </div>
                <button class="copy-btn" data-action="copy-tokens">复制所有Token</button>
                <button class="copy-btn" data-action="copy-storage">复制Storage</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📡 API请求 (${capturedRequests.length})</h4>
                <div class="info-content"><pre>${JSON.stringify(capturedRequests.slice(-5), null, 2)}</pre></div>
                <button class="copy-btn" data-action="copy-requests">复制</button>
            </div>
        `;

        if (capturedRequests.length > 0) {
            html += '<div class="panel-section"><h4>🔧 Curl命令</h4>';
            capturedRequests.slice(-3).forEach(req => {
                const curl = generateCurl(req);
                html += `<div class="info-content"><pre>${curl}</pre></div>`;
            });
            html += '</div>';
        }

        html += `
            <div class="panel-section">
                <h4>🖼️ 图片链接 (${imageLinks.length})</h4>
                <div class="info-content"><pre>${imageLinks.join('\\n')}</pre></div>
                <button class="copy-btn" data-action="copy-images">复制</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <button class="copy-btn" data-action="refresh">刷新</button>
                <button class="clear-btn" data-action="clear">清空</button>
            </div>
        `;

        currentPanel.innerHTML = html;
        addButtonListeners();
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

    // 创建按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = '🎨';
    toggleBtn.title = 'MindVideo API提取器 v2.2';
    toggleBtn.onclick = createPanel;
    document.body.appendChild(toggleBtn);

    console.log('🎨 MindVideo API提取器 v2.2 已加载 - 按钮修复 + Token增强');
    window.mindvideoUpdate = updatePanel;
})();