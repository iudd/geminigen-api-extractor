// ==UserScript==
// @name         MindVideo API Extractor
// @namespace    http://tampermonkey.net/
// @version      2.4.0
// @description  Extract API information and token from mindvideo.ai for curl/API usage - Fixed Mobile Clipboard + Enhanced Copy
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
        .copy-btn.copying {
            background: #ff9800;
            color: black;
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
        .cleared-state {
            color: #ff9800;
            font-style: italic;
        }
        .storage-section {
            background: rgba(255, 193, 7, 0.1);
            border-color: #ffc107;
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
    `);

    // 全局变量
    let currentPanel = null;
    let capturedRequests = [];
    let capturedTokens = [];
    let originalFetch = null;
    let originalXHR = null;
    let isInterceptionActive = false;
    let isCleared = false;

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

    // 提取Storage中的Token
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

    // 增强复制功能 - 移动端兼容
    async function copyToClipboard(text, btn = null) {
        console.log('复制数据:', text.substring(0, 100) + '...'); // 调试

        // 方法1: GM_setClipboard (Tampermonkey)
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text);
            showNotification('✅ 已复制到剪贴板！');
            if (btn) btn.textContent = '已复制 ✓';
            return true;
        }

        // 方法2: navigator.clipboard (现代浏览器)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                showNotification('✅ 已复制到剪贴板！');
                if (btn) btn.textContent = '已复制 ✓';
                return true;
            } catch (e) {
                console.log('Clipboard API失败:', e);
            }
        }

        // 方法3: textarea execCommand (兼容性)
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-999999px';
            ta.style.top = '-999999px';
            ta.style.opacity = 0;
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, 99999); // 移动端优化
            const successful = document.execCommand('copy');
            document.body.removeChild(ta);
            if (successful) {
                showNotification('✅ 已复制到剪贴板！');
                if (btn) btn.textContent = '已复制 ✓';
                return true;
            }
        } catch (e) {
            console.log('execCommand失败:', e);
        }

        // 方法4: 提示框手动复制 (终极兼容)
        const copied = prompt('请手动复制以下内容:', text);
        if (copied !== null) {
            showNotification('📋 已选中，请长按粘贴！');
            if (btn) btn.textContent = '手动复制 ✓';
            return true;
        }

        showNotification('❌ 复制失败，请重试');
        if (btn) btn.textContent = '复制失败';
        return false;
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

        switch (action) {
            case 'copy-page':
                text = JSON.stringify(extractPageInfo(), null, 2);
                copyToClipboard(text, btn);
                break;
            case 'copy-tokens':
                text = capturedTokens.map(t => `${t.source}.${t.key || 'header'}:\n${t.full}\n`).join('\n');
                copyToClipboard(text, btn);
                break;
            case 'copy-requests':
                text = JSON.stringify(capturedRequests.slice(-5), null, 2);
                copyToClipboard(text, btn);
                break;
            case 'copy-images':
                text = extractImageLinks().join('\n');
                copyToClipboard(text, btn);
                break;
            case 'clear':
                capturedRequests = [];
                capturedTokens = [];
                isCleared = true;
                console.log('清空成功');
                showNotification('✅ 已清空数据！重新生成查看新数据');
                updatePanel();
                btn.classList.remove('copying');
                break;
            case 'refresh':
                updatePanel();
                showNotification('🔄 已刷新面板');
                btn.classList.remove('copying');
                break;
            default:
                console.log('未知动作:', action);
                btn.classList.remove('copying');
        }
    }

    // 添加事件监听 (移动端+桌面)
    function addButtonListeners() {
        if (!currentPanel) return;
        const container = currentPanel;
        container.removeEventListener('click', handleButtonClick);
        container.removeEventListener('touchend', handleButtonClick);
        container.addEventListener('click', handleButtonClick);
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
                🎯 MindVideo API提取器 v2.4
                <button class="close-btn" onclick="this.closest('.mindvideo-panel').remove();">×</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📄 页面信息</h4>
                <div class="info-content"><pre>${JSON.stringify(pageInfo, null, 2)}</pre></div>
                <button class="copy-btn" data-action="copy-page">复制页面信息</button>
            </div>
        `;

        html += `
            <div class="panel-section storage-section">
                <h4>🔑 Token & Keys (${allTokens.length})</h4>
                <div class="info-content">
                    ${allTokens.length > 0 ? allTokens.slice(-10).map(t => `
                        <div style="margin-bottom: 8px;">
                            <strong>${t.source}:</strong> <span class="token-highlight">${t.value}</span><br>
                            <small>${t.key || 'N/A'} | ${t.url?.substring(0, 60) || ''}</small>
                        </div>
                    `).join('') : '<div class="no-data">暂无Token - 生成图片后自动捕获</div>'}
                </div>
                ${allTokens.length > 0 ? '<button class="copy-btn" data-action="copy-tokens">复制所有Token</button>' : ''}
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📡 API请求 (${capturedRequests.length})</h4>
                <div class="info-content">
                    ${capturedRequests.length > 0 ? capturedRequests.slice(-5).map(req => `
                        <div style="margin-bottom: 8px;">
                            <span class="method-${req.method.toLowerCase()}">${req.method}</span> ${req.url.split('/').pop()}<br>
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
                    ${capturedRequests.slice(-3).map(req => {
                        const curl = generateCurl(req);
                        return `<div class="info-content"><pre>${curl}</pre></div>`;
                    }).join('')}
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

    // 其他函数保持不变...
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

            if (options.body) {
                if (typeof options.body === 'string') bodyStr = options.body;
                else if (options.body.text) bodyStr = await options.body.text();
            }

            if (urlStr.includes('mindvideo.ai') || urlStr.includes('mindvideo')) {
                const requestInfo = {
                    method,
                    url: urlStr,
                    headers: { ...headers },
                    body: bodyStr,
                    timestamp: new Date().toLocaleString()
                };

                Object.keys(headers).forEach(key => {
                    const value = headers[key];
                    if (value && (
                        value.includes('Bearer ') ||
                        key.toLowerCase().includes('token') ||
                        key.toLowerCase().includes('auth') ||
                        key.toLowerCase().includes('session') ||
                        value.includes('eyJ') ||
                        value.match(/[!#\$%^&*]{2,}/)
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

        // XHR拦截 (简化版)
        if (window.XMLHttpRequest) {
            originalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const originalOpen = xhr.open;
                xhr.open = function(method, url) {
                    if (url.includes('mindvideo')) {
                        // Token捕获逻辑类似fetch
                    }
                    originalOpen.apply(this, arguments);
                };
                return xhr;
            };
        }
    }

    function stopInterception() {
        if (!isInterceptionActive) return;
        isInterceptionActive = false;
        if (originalFetch) window.fetch = originalFetch;
        if (originalXHR) window.XMLHttpRequest = originalXHR;
        console.log('拦截已停止');
    }

    function generateCurl(request) {
        let curl = `curl -X ${request.method} "${request.url}"`;
        Object.entries(request.headers || {}).forEach(([key, value]) => {
            curl += ` \\\n  -H "${key}: ${value}"`;
        });
        if (request.body) curl += ` \\\n  -d '${request.body.replace(/'/g, "'\\''")}'`;
        return curl;
    }

    function showNotification(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:12px;border-radius:6px;z-index:10002;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:14px;';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2500);
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
    toggleBtn.title = 'MindVideo API提取器 v2.4 - 移动端复制修复';
    toggleBtn.onclick = createPanel;
    toggleBtn.addEventListener('touchstart', createPanel, { passive: false });
    document.body.appendChild(toggleBtn);

    console.log('🎨 MindVideo API提取器 v2.4 已加载 - 移动端剪贴板修复');
    window.mindvideoDebug = { update: updatePanel, copy: copyToClipboard };
})();