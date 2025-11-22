// ==UserScript==
// @name         MindVideo API Extractor
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Extract API information and token from mindvideo.ai for curl/API usage - Text-to-Image focused
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
    `);

    // 全局变量
    let currentPanel = null;
    let capturedRequests = [];
    let capturedTokens = [];
    let originalFetch = null;
    let originalXHR = null;
    let isInterceptionActive = false;

    // 提取页面信息 - 专门针对文生图页面
    function extractPageInfo() {
        const info = {
            url: window.location.href,
            title: document.title,
            page: 'text-to-image', // 标识为文生图页面
            timestamp: new Date().toLocaleString()
        };

        // 提取输入框 (提示词)
        const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
        inputs.forEach(input => {
            if (input.value && input.value.trim().length > 2) {
                const label = input.previousElementSibling?.textContent?.trim() ||
                             input.placeholder ||
                             input.name ||
                             input.id ||
                             'prompt';
                info[label] = input.value.trim();
            }
        });

        // 提取选择器 (尺寸、风格等)
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            if (select.value) {
                const label = select.previousElementSibling?.textContent?.trim() ||
                             select.name ||
                             select.id ||
                             'size';
                info[label] = select.value;
            }
        });

        // 提取单选框和复选框
        const radios = document.querySelectorAll('input[type="radio"]:checked');
        radios.forEach(radio => {
            info[radio.name || 'radio'] = radio.value;
        });

        // 提取按钮信息
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        info.buttons = Array.from(buttons).map(btn => ({
            text: btn.textContent?.trim() || btn.value?.trim(),
            class: btn.className,
            id: btn.id,
            disabled: btn.disabled,
            type: btn.type
        }));

        return info;
    }

    // 提取图片链接 - 针对文生图结果
    function extractImageLinks() {
        const links = [];

        // 查找img元素
        document.querySelectorAll('img[src]').forEach(img => {
            const src = img.src;
            if (src && (src.includes('.jpg') || src.includes('.png') || src.includes('.webp') ||
                src.includes('cdn.mindvideo') || src.includes('image'))) {
                links.push({
                    type: 'image',
                    url: src,
                    alt: img.alt,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    timestamp: new Date().toLocaleString()
                });
            }
        });

        // 查找下载链接
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.href;
            if (href && (href.includes('.jpg') || href.includes('.png') || href.includes('.webp') ||
                href.includes('download') || href.includes('export'))) {
                links.push({
                    type: 'download',
                    url: href,
                    text: link.textContent?.trim(),
                    timestamp: new Date().toLocaleString()
                });
            }
        });

        return links;
    }

    // 拦截网络请求 - 专门针对MindVideo API
    function startInterception() {
        if (isInterceptionActive) return;
        isInterceptionActive = true;
        console.log('🕸️ 开始拦截MindVideo网络请求...');

        // Fetch拦截
        originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            const urlStr = typeof url === 'string' ? url : url.href;
            const method = options.method || 'GET';
            const headers = options.headers || {};
            const body = options.body;

            // 专门捕获MindVideo相关请求
            if (urlStr.includes('mindvideo.ai') &&
                (urlStr.includes('/api/') || urlStr.includes('/v2/') ||
                 urlStr.includes('creations') || urlStr.includes('generate') ||
                 method === 'POST' || method === 'PUT')) {

                const requestInfo = {
                    method,
                    url: urlStr,
                    headers: { ...headers }, // 复制headers避免引用问题
                    body: body ? (typeof body === 'string' ? body : await body.text()) : null,
                    timestamp: new Date().toLocaleString()
                };

                // 提取Token - MindVideo使用Bearer认证
                const authHeader = headers.authorization || headers.Authorization;
                if (authHeader && authHeader.includes('Bearer ')) {
                    const token = authHeader.replace('Bearer ', '');
                    capturedTokens.push({
                        token,
                        url: urlStr,
                        method,
                        timestamp: new Date().toLocaleString()
                    });
                    console.log('🎫 捕获到MindVideo Token!');
                }

                capturedRequests.push(requestInfo);
                console.log('📡 捕获MindVideo请求:', method, urlStr.split('/').pop());
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
                if (url.includes('mindvideo.ai') &&
                    (url.includes('/api/') || url.includes('/v2/') ||
                     url.includes('creations') || url.includes('generate'))) {
                    requestInfo = {
                        method,
                        url,
                        headers: {},
                        timestamp: new Date().toLocaleString()
                    };
                }
                originalOpen(method, url, ...args);
            };

            xhr.setRequestHeader = function(key, value) {
                if (requestInfo.url) {
                    requestInfo.headers[key] = value;
                }
                xhr.setRequestHeader(key, value);
            };

            xhr.send = function(body) {
                if (requestInfo.url) {
                    requestInfo.body = body;

                    // 提取Token
                    const authHeader = requestInfo.headers.authorization || requestInfo.headers.Authorization;
                    if (authHeader && authHeader.includes('Bearer ')) {
                        const token = authHeader.replace('Bearer ', '');
                        capturedTokens.push({
                            token,
                            url: requestInfo.url,
                            method: requestInfo.method,
                            timestamp: new Date().toLocaleString()
                        });
                        console.log('🎫 XHR捕获到MindVideo Token!');
                    }

                    capturedRequests.push(requestInfo);
                    console.log('📡 XHR捕获MindVideo请求:', requestInfo.method, requestInfo.url.split('/').pop());
                    updatePanel();
                }

                originalSend(body);
            };

            return xhr;
        };
    }

    // 停止拦截
    function stopInterception() {
        if (!isInterceptionActive) return;

        if (originalFetch) {
            window.fetch = originalFetch;
            originalFetch = null;
        }

        if (originalXHR) {
            window.XMLHttpRequest = originalXHR;
            originalXHR = null;
        }

        isInterceptionActive = false;
        console.log('🛑 停止拦截MindVideo请求');
    }

    // 生成Curl命令 - MindVideo专用
    function generateCurl(request) {
        let curl = `curl -X ${request.method} "${request.url}"`;

        // 添加headers
        Object.entries(request.headers).forEach(([key, value]) => {
            if (key.toLowerCase() === 'authorization') {
                // Token安全处理
                curl += ` \\\n  -H "${key}: ${value.substring(0, 20)}...[HIDDEN]"`;
            } else {
                curl += ` \\\n  -H "${key}: ${value}"`;
            }
        });

        // 添加body
        if (request.body) {
            let body = request.body;
            if (typeof body === 'string') {
                // 转义引号和换行符
                body = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            } else {
                body = JSON.stringify(body).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            }
            curl += ` \\\n  -d "${body}"`;
        }

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
        const imageLinks = extractImageLinks();

        let html = `
            <div class="panel-header">
                🎯 MindVideo API提取器 v2.0
                <button class="close-btn" onclick="this.closest('.mindvideo-panel').remove();">×</button>
            </div>
        `;

        // 页面信息
        html += `
            <div class="panel-section">
                <h4>📄 页面信息 - 文生图</h4>
                <div class="info-content"><pre>${JSON.stringify(pageInfo, null, 2)}</pre></div>
                <button class="copy-btn" onclick="copyToClipboard(JSON.stringify(${JSON.stringify(pageInfo)}, null, 2))">复制</button>
            </div>
        `;

        // Token列表 - 专门针对MindVideo
        html += `
            <div class="panel-section">
                <h4>🔑 捕获的MindVideo Token (${capturedTokens.length})</h4>
                <div class="info-content">
                    ${capturedTokens.length > 0 ?
                        capturedTokens.map(t => `
                            <div>
                                <strong>Token:</strong> <span class="token-highlight">${t.token.substring(0, 50)}...</span><br>
                                <small class="method-${t.method.toLowerCase()}">${t.method}</small> <span class="api-endpoint">${t.url.split('/').pop()}</span><br>
                                <small>${t.timestamp}</small>
                            </div>
                        `).join('<hr style="border-color:#555;margin:8px 0;">') :
                        '暂无Token - 请点击"生成"按钮触发API请求'
                    }
                </div>
                ${capturedTokens.length > 0 ? '<button class="copy-btn" onclick="copyToClipboard(\'' + capturedTokens.map(t => t.token).join('\\n') + '\')">复制所有Token</button>' : ''}
            </div>
        `;

        // API请求
        html += `
            <div class="panel-section">
                <h4>📡 MindVideo API请求 (${capturedRequests.length})</h4>
                <div class="info-content">
                    ${capturedRequests.length > 0 ?
                        capturedRequests.slice(-5).map(req => `
                            <div>
                                <span class="method-${req.method.toLowerCase()}">${req.method}</span> <span class="api-endpoint">${req.url.split('/').pop()}</span><br>
                                <small>${req.url}</small><br>
                                <small>${req.timestamp}</small>
                            </div>
                        `).join('<hr style="border-color:#555;margin:8px 0;">') :
                        '暂无API请求 - 请点击"生成"按钮'
                    }
                </div>
                ${capturedRequests.length > 0 ? '<button class="copy-btn" onclick="copyToClipboard(JSON.stringify(' + JSON.stringify(capturedRequests.slice(-5)) + ', null, 2))">复制请求详情</button>' : ''}
            </div>
        `;

        // Curl命令
        if (capturedRequests.length > 0) {
            html += '<div class="panel-section"><h4>🔧 Curl命令 (可直接使用)</h4>';
            capturedRequests.slice(-3).forEach((req, i) => {
                const curl = generateCurl(req);
                html += `<div class="info-content"><pre>${curl}</pre><button class="copy-btn" onclick="copyToClipboard('${curl.replace(/'/g, "\\'")}')">复制Curl</button></div>`;
            });
            html += '</div>';
        }

        // 图片链接
        html += `
            <div class="panel-section">
                <h4>🖼️ 生成的图片链接 (${imageLinks.length})</h4>
                <div class="info-content">
                    ${imageLinks.length > 0 ?
                        imageLinks.map(img => `
                            <div>
                                <strong>${img.type}:</strong> ${img.url.split('/').pop()}<br>
                                <small>${img.url}</small><br>
                                ${img.width && img.height ? `<small>尺寸: ${img.width}x${img.height}</small>` : ''}
                            </div>
                        `).join('<hr style="border-color:#555;margin:8px 0;">') :
                        '暂无图片 - 生成完成后会自动显示'
                    }
                </div>
                ${imageLinks.length > 0 ? '<button class="copy-btn" onclick="copyToClipboard(\'' + imageLinks.map(img => img.url).join('\\n') + '\')">复制图片链接</button>' : ''}
            </div>
        `;

        // 操作按钮
        html += `
            <div class="panel-section">
                <button class="copy-btn" onclick="startInterception()">开始拦截</button>
                <button class="copy-btn" onclick="stopInterception()">停止拦截</button>
                <button class="refresh-btn" onclick="updatePanel()">刷新</button>
                <button class="clear-btn" onclick="capturedRequests=[];capturedTokens=[];updatePanel()">清空</button>
            </div>
        `;

        currentPanel.innerHTML = html;
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
        currentPanel.innerHTML = `
            <div class="panel-header">
                🎯 MindVideo API提取器 v2.0
                <div>
                    <span style="color:#4CAF50;font-size:12px;">文生图专用</span>
                    <button class="close-btn" onclick="this.closest('.mindvideo-panel').remove();">×</button>
                </div>
            </div>
            <div class="panel-section">
                <div class="no-data">正在初始化... 请点击"生成"按钮触发API请求</div>
            </div>
        `;

        document.body.appendChild(currentPanel);
        startInterception();
        updatePanel();
        setInterval(updatePanel, 2000);
    }

    // 创建切换按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = '🎨';
    toggleBtn.title = 'MindVideo API提取器 - 文生图';
    toggleBtn.onclick = createPanel;
    document.body.appendChild(toggleBtn);

    console.log('🎨 MindVideo API提取器 v2.0 已加载 - 文生图专用');
})();