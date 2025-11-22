// MindVideo 2 API - Cloudflare Workers
// 将MindVideo转换为标准API服务

export default {
  async fetch(request, env, ctx) {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 健康检查
    if (path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'MindVideo 2 API'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // OpenAI兼容API
    if (path === '/v1/chat/completions') {
      return handleChatCompletions(request, env);
    }

    // MindVideo原生API
    if (path.startsWith('/api/')) {
      return handleMindVideoAPI(request, env);
    }

    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'Endpoint not found'
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

// 处理OpenAI兼容的聊天完成请求
async function handleChatCompletions(request, env) {
  try {
    const body = await request.json();

    // 提取提示词
    const prompt = body.messages?.[body.messages.length - 1]?.content || '';

    // 调用MindVideo API
    const mindvideoResponse = await callMindVideoAPI(prompt, env);

    // 转换为OpenAI格式
    const openaiResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'gpt-3.5-turbo',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: mindvideoResponse.content || '生成失败'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: mindvideoResponse.content?.length || 0,
        total_tokens: prompt.length + (mindvideoResponse.content?.length || 0)
      }
    };

    return new Response(JSON.stringify(openaiResponse), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// 处理MindVideo原生API请求
async function handleMindVideoAPI(request, env) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    // 调用MindVideo API
    const response = await callMindVideoAPI(body.prompt || '', env);

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// 调用MindVideo API
async function callMindVideoAPI(prompt, env) {
  const tokens = env.AUTH_TOKENS ? JSON.parse(env.AUTH_TOKENS) : [];
  const token = tokens[Math.floor(Math.random() * tokens.length)];

  if (!token) {
    throw new Error('No auth token available');
  }

  const response = await fetch('https://api.mindvideo.ai/api/v2/creations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify({
      type: 8, // 文生图
      bot_id: 190,
      options: {
        prompt: prompt
      }
    })
  });

  if (!response.ok) {
    throw new Error(`MindVideo API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}