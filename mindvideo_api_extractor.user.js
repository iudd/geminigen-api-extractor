// ==UserScript==
// @name         MindVideo API Extractor
// @namespace    http://tampermonkey.net/
// @version      2.5.0
// @description  Extract API information and token from mindvideo.ai for curl/API usage - Mobile Copy Fixed
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

    // 添加样式 - 增加移动端复制提示
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
        .copy-result {
            background: rgba(0, 255, 0, 0.1);
            border: 2px solid #4CAF50;
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            max-height: 150px;
            overflow-y: auto;
        }
        .copy-result.error {
            background: rgba(255, 0, 0, 0.1);
            border-color: #f44336;
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
    let copyResultDiv = null; // 新增：复制结果显示区域

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

    // 移动端优化复制功能 - 优先显示内容让用户手动复制
    async function copyToClipboard(text, btn = null) {
        console.log('🔄 复制数据长度:', text.length, '预览:', text.substring(0, 50) + '...');

        // 创建复制结果显示区域
        if (!copyResultDiv) {
            copyResultDiv = document.createElement('div');
            copyResultDiv.className = 'copy-result';
            copyResultDiv.style.cssText = `
                position: fixed;
                top: 60px;
                left: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
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
            `;
            document.body.appendChild(copyResultDiv);
        }

        // 显示复制内容
        copyResultDiv.textContent = `📋 复制内容 (长按下方区域全选复制):\n\n${text}`;
        copyResultDiv.style.display = 'block';

        // 自动隐藏
        setTimeout(() => {
            if (copyResultDiv) copyResultDiv.style.display = 'none';
        }, 10000);

        // 方法1: 尝试GM_setClipboard (Tampermonkey)
        if (typeof GM_setClipboard === 'function') {
            try {
                GM_setClipboard(text);
                showNotification('✅ GM_setClipboard成功！也可手动长按上方绿色区域复制');
                if (btn) btn.textContent = '已复制 ✓';
                return true;
            } catch (e) {
                console.log('GM_setClipboard失败:', e);
            }
        }

        // 方法2: 尝试navigator.clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                showNotification('✅ Clipboard API成功！也可手动长按上方绿色区域复制');
                if (btn) btn.textContent = '已复制 ✓';
                return true;
            } catch (e) {
                console.log('Clipboard API失败:', e);
            }
        }

        // 方法3: textarea + execCommand (最后的尝试)
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            ta.style.opacity = 0;
            ta.style.width = '1px';
            ta.style.height = '1px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, 99999);
            const success = document.execCommand('copy');
            document.body.removeChild(ta);
            if (success) {
                showNotification('✅ execCommand成功！也可手动长按上方绿色区域复制');
                if (btn) btn.textContent = '已复制 ✓';
                return true;
            }
        } catch (e) {
            console.log('execCommand失败:', e);
        }

        // 所有方法都失败 - 只显示绿色区域让用户手动复制
        showNotification('📱 请长按上方绿色区域全选复制！');
        if (btn) btn.textContent = '请手动复制';
        return false;
    }

    // 通知
    function showNotification(msg, isError = false) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.className = `notification ${isError ? 'error' : ''}`;
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isError ? '#f44336' : '#4CAF50'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10002;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            max-width: 300px;
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // 拦截网络请求
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
    }

    // 停止拦截
    function stopInterception() {
        if (!isInterceptionActive) return;
        isInterceptionActive = false;
        if (originalFetch) window.fetch = originalFetch;
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
                🎯 MindVideo API提取器 v2.5
                <button class="close-btn" onclick="this.closest('.mindvideo-panel').remove();stopInterception();">×</button>
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
    toggleBtn.title = 'MindVideo API提取器 v2.5 - 移动端复制优化';
    toggleBtn.onclick = createPanel;
    toggleBtn.addEventListener('touchstart', createPanel, { passive: false });
    document.body.appendChild(toggleBtn);

    console.log('🎨 MindVideo API提取器 v2.5 已加载 - 移动端复制优化 + 绿色区域显示');
    window.mindvideoDebug = { update: updatePanel, copy: copyToClipboard };
})();