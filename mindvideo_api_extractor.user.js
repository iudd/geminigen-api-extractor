// ==UserScript==
// @name         MindVideo API Extractor
// @namespace    http://tampermonkey.net/
// @version      2.3.0
// @description  Extract API information and token from mindvideo.ai for curl/API usage - Clear button fixed + Image cache cleared
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
        .cleared-state {
            color: #ff9800;
            font-style: italic;
            background: rgba(255, 152, 0, 0.1);
            padding: 8px;
            border-radius: 4px;
            border-left: 4px solid #ff9800;
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
        .token-highlight {
            background: #4CAF50;
            color: black;
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: bold;
            font-family: monospace;
        }
        .no-data {
            color: #888;
            font-style: italic;
            padding: 15px;
            text-align: center;
        }
    `);

    // 全局变量
    let currentPanel = null;
    let capturedRequests = [];
    let capturedTokens = [];
    let imageCache = []; // 新增图片缓存
    let cleared = false; // 清空状态标志
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

        return info;
    }

    // 提取图片链接并缓存
    function extractImageLinks() {
        if (cleared) return []; // 清空状态下返回空数组
        const links = [];
        document.querySelectorAll('img[src], a[href*=".jpg"], a[href*=".png"], a[href*=".webp"]').forEach(el => {
            const url = el.src || el.href;
            if (url && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp') || url.includes('mindvideo'))) {
                links.push(url);
            }
        });
        imageCache = links; // 更新缓存
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

    // 停止拦截
    function stopInterception() {
        if (originalFetch) window.fetch = originalFetch;
        if (originalXHR) window.XMLHttpRequest = originalXHR;
        isInterceptionActive = false;
    }

    // 生成Curl
    function generateCurl(request) {
        let curl = `curl -X ${request.method} "${request.url}"`;
        Object.entries(request.headers || {}).forEach(([key, value]) => {
            curl += ` \\\n  -H "${key}: ${value}"`;
        });
        if (request.body) curl += ` \\\n  -d '${request.body.replace(/'/g, "'\\\\'")} '`;
        return curl;
    }

    // 复制
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => showNotification('已复制！')).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = 0;
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showNotification('已复制！');
        });
    }

    // 通知
    function showNotification(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4CAF50;color:white;padding:12px;border-radius:6px;z-index:10002;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2500);
    }

    // 按钮事件处理 - 增强版
    function handleButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        showNotification('操作中...');

        switch (action) {
            case 'clear':
                capturedRequests = [];
                capturedTokens = [];
                imageCache = [];
                cleared = true;
                showNotification('✅ 数据已清空！图片缓存已清除');
                updatePanel();
                break;
            case 'refresh':
                cleared = false;
                updatePanel();
                showNotification('🔄 已刷新');
                break;
            case 'copy-tokens':
                const tokenText = capturedTokens.map(t => t.full).join('\\n\\n');
                copyToClipboard(tokenText);
                break;
            case 'copy-requests':
                copyToClipboard(JSON.stringify(capturedRequests.slice(-5), null, 2));
                break;
            case 'copy-images':
                copyToClipboard(imageCache.join('\\n'));
                break;
            default:
                showNotification('功能开发中...');
        }
    }

    // 更新面板
    function updatePanel() {
        if (!currentPanel) return;

        const pageInfo = extractPageInfo();
        const currentImages = extractImageLinks();
        const storageTokens = extractFromStorage();
        const allTokens = [...capturedTokens, ...storageTokens];

        let html = `
            <div class="panel-header">
                🎯 MindVideo API提取器 v2.3
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
            <div class="panel-section">
                <h4>🔑 Token & Keys (${allTokens.length})</h4>
                <div class="info-content">
                    ${allTokens.length ? allTokens.slice(-8).map(t => `
                        <div style="margin-bottom: 8px;">
                            <strong>${t.source}:</strong> <span class="token-highlight">${t.value}</span><br>
                            <small>${t.key} | ${t.url?.substring(0, 60) || 'N/A'}</small>
                        </div>
                    `).join('') : '<div class="no-data">生成请求后自动捕获</div>'}
                </div>
                <button class="copy-btn" data-action="copy-tokens">复制所有Token</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>📡 API请求 (${capturedRequests.length})</h4>
                <div class="info-content">
                    ${capturedRequests.length ? capturedRequests.slice(-5).map(r => `<div>${r.method} ${r.url.split('/').pop()} (${r.timestamp})</div>`).join('') : '<div class="no-data">暂无请求</div>'}
                </div>
                <button class="copy-btn" data-action="copy-requests">复制请求详情</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <h4>🖼️ 图片链接 (${imageCache.length || currentImages.length})</h4>
                <div class="info-content">
                    ${cleared ? '<div class="cleared-state">✅ 已清空图片缓存！<br>刷新页面或重新生成可恢复。</div>' : 
                    (imageCache.length ? imageCache.map(img => `<div>${img.split('/').pop()}</div>`).join('') : '<div class="no-data">暂无图片</div>')}
                </div>
                <button class="copy-btn" data-action="copy-images">复制图片链接</button>
            </div>
        `;

        html += `
            <div class="panel-section">
                <button class="refresh-btn" data-action="refresh">🔄 刷新</button>
                <button class="clear-btn" data-action="clear">🗑️ 清空数据</button>
            </div>
        `;

        currentPanel.innerHTML = html;
        
        // 事件绑定 - 支持touch和click
        currentPanel.addEventListener('click', handleButtonClick, true);
        currentPanel.addEventListener('touchend', handleButtonClick, true);
        
        console.log('面板更新完成，数据状态:', {requests: capturedRequests.length, tokens: capturedTokens.length, cleared});
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

    // 创建toggle按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = '🎨';
    toggleBtn.title = 'MindVideo API提取器 v2.3 - 清空修复';
    toggleBtn.onclick = createPanel;
    toggleBtn.addEventListener('touchend', createPanel);
    document.body.appendChild(toggleBtn);

    console.log('🎨 MindVideo API提取器 v2.3 已加载 - 清空按钮彻底修复');
})();