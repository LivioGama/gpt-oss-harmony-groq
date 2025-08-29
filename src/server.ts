import {ChatHandler} from './chat-handler';
import {GROQ_API_KEY, loadEnvFile, PORT} from './config';
import {logError, logRequest, logResponse} from './logger';
import type {OpenAIChatRequest} from './types';

loadEnvFile();

if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY environment variable is required');
    process.exit(1);
}

const chatHandler = new ChatHandler();

const createErrorResponse = (
    message: string,
    type: string = 'invalid_request_error',
    status: number = 400
): Response => {
    return new Response(
        JSON.stringify({
            error: {
                message,
                type,
                code: null
            }
        }),
        {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent'
            }
        }
    );
};

const createSuccessResponse = (data: any, headers: Record<string, string> = {}): Response => {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
            ...headers
        }
    });
};

const createStreamResponse = (stream: ReadableStream): Response => {
    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
            'X-Accel-Buffering': 'no'
        }
    });
};

const generateRequestId = (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const requestId = generateRequestId();
        const startTime = Date.now();
        const method = req.method;
        const url = new URL(req.url);
        const path = url.pathname;
        const userAgent = req.headers.get('User-Agent') || undefined;

        logRequest(requestId, method, path, userAgent);

        try {
            if (method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
                        'Access-Control-Max-Age': '86400'
                    }
                });
            }

            if (method === 'GET' && path === '/') {
                const response = createSuccessResponse({
                    message: 'GPT-OSS Harmony Groq Proxy Server',
                    version: '1.0.0',
                    endpoints: [
                        'POST /v1/chat/completions',
                        'GET /v1/models',
                        'GET /health'
                    ],
                    features: [
                        'Transformers chat templates',
                        'Harmony format support',
                        'Groq API integration',
                        'Cline/Cursor compatibility',
                        'Tool calling support',
                        'Streaming responses'
                    ]
                });
                logResponse(requestId, 200, Date.now() - startTime);
                return response;
            }

            if (method === 'GET' && path === '/health') {
                const response = createSuccessResponse({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime()
                });
                logResponse(requestId, 200, Date.now() - startTime);
                return response;
            }

            if (method === 'GET' && path === '/v1/models') {
                try {
                    const models = await chatHandler.getModels();
                    const response = createSuccessResponse(models);
                    logResponse(requestId, 200, Date.now() - startTime);
                    return response;
                } catch (error) {
                    logError(`Models request failed for ${requestId}`, error);
                    const response = createErrorResponse(
                        'Failed to fetch models',
                        'internal_server_error',
                        500
                    );
                    logResponse(requestId, 500, Date.now() - startTime);
                    return response;
                }
            }

            if (method === 'POST' && path === '/v1/chat/completions') {
                try {
                    const body: OpenAIChatRequest = await req.json();

                    if (body.stream) {
                        const stream = await chatHandler.handleStreamingChatCompletion(body, userAgent);
                        logResponse(requestId, 200, Date.now() - startTime);
                        return createStreamResponse(stream);
                    } else {
                        const completion = await chatHandler.handleChatCompletion(body, userAgent);
                        const response = createSuccessResponse(completion);
                        logResponse(requestId, 200, Date.now() - startTime);
                        return response;
                    }
                } catch (error) {
                    logError(`Chat completion failed for ${requestId}`, error);
                    const response = createErrorResponse(
                        error instanceof Error ? error.message : 'Internal server error',
                        'internal_server_error',
                        500
                    );
                    logResponse(requestId, 500, Date.now() - startTime);
                    return response;
                }
            }

            const response = createErrorResponse(
                `Not found: ${method} ${path}`,
                'not_found_error',
                404
            );
            logResponse(requestId, 404, Date.now() - startTime);
            return response;

        } catch (error) {
            logError(`Request handling failed for ${requestId}`, error);
            const response = createErrorResponse(
                'Internal server error',
                'internal_server_error',
                500
            );
            logResponse(requestId, 500, Date.now() - startTime);
            return response;
        }
    },
});

console.log(`🚀 GPT-OSS Harmony Groq Proxy Server running on http://localhost:${PORT}`);
console.log(`📚 Features:`);
console.log(`   • Transformers chat templates with built-in harmony format`);
console.log(`   • Groq API integration for gpt-oss-20b`);
console.log(`   • Cline/Cursor compatibility layer`);
console.log(`   • Tool calling and streaming support`);
console.log(`   • OpenAI-compatible endpoints`);
console.log(`\n🔗 Endpoints:`);
console.log(`   • POST /v1/chat/completions - Chat completions`);
console.log(`   • GET /v1/models - Available models`);
console.log(`   • GET /health - Health check`);
console.log(`\n💡 Usage:`);
console.log(`   curl -X POST http://localhost:${PORT}/v1/chat/completions \\`);
console.log(`     -H "Content-Type: application/json" \\`);
console.log(`     -d '{"model": "gpt-oss-20b", "messages": [{"role": "user", "content": "Hello!"}]}'`);

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    server.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.stop();
    process.exit(0);
});
