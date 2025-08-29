import {GROQ_API_KEY, GROQ_HOST} from './config';
import {convertToHarmonyFormat, parseHarmonyResponse} from './harmony-integration';
import type {GroqResponse, OpenAIChatRequest} from './types';

export class GroqClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey?: string, baseUrl?: string) {
        this.apiKey = apiKey || GROQ_API_KEY || '';
        this.baseUrl = baseUrl || GROQ_HOST;

        if (!this.apiKey) {
            throw new Error('Groq API key is required');
        }
    }

    async createChatCompletion(request: OpenAIChatRequest): Promise<GroqResponse> {
        const url = `${this.baseUrl}/openai/v1/chat/completions`;

        let processedRequest = {...request};
        const isGptOss = this.isGptOssModel(request.model);

        if (isGptOss) {
            // Handle tool_choice: 'none' - if tools should be disabled, don't include them in harmony format
            const effectiveTools = (request.tool_choice === 'none') ? undefined : request.tools;
            const harmonyPrompt = convertToHarmonyFormat(request.messages, effectiveTools, true, request.tool_choice, request.tools);

            processedRequest.messages = [{role: 'user', content: harmonyPrompt}];

            // Handle tool_choice logic
            if (request.tool_choice === 'none') {
                // Remove tools and tool_choice entirely when explicitly set to 'none'
                processedRequest.tools = undefined;
                processedRequest.tool_choice = undefined;
            } else if (request.tools && !request.tool_choice) {
                // Default to 'auto' when tools are present but no choice specified
                processedRequest.tool_choice = 'auto';
            }
        }

        const body = {
            model: processedRequest.model,
            messages: processedRequest.messages,
            temperature: processedRequest.temperature,
            max_tokens: processedRequest.max_tokens,
            top_p: processedRequest.top_p,
            frequency_penalty: processedRequest.frequency_penalty,
            presence_penalty: processedRequest.presence_penalty,
            stop: processedRequest.stop,
            stream: false,
            tools: processedRequest.tools,
            tool_choice: processedRequest.tool_choice,
            response_format: processedRequest.response_format,
            user: processedRequest.user
        };

        Object.keys(body).forEach(key => {
            if (body[key as keyof typeof body] === undefined) {
                delete body[key as keyof typeof body];
            }
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'User-Agent': 'gpt-oss-harmony-groq/1.0.0'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Groq API error ${response.status}:`, errorText);
            console.error(`Request body length:`, JSON.stringify(body).length);
            console.error(`Request body preview:`, JSON.stringify(body).substring(0, 500));
            throw new Error(`Groq API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const groqResponse = await response.json() as GroqResponse;

        if (isGptOss && groqResponse.choices?.[0]?.message?.content) {
            const parsedResponse = parseHarmonyResponse(groqResponse.choices[0].message.content, request);
            groqResponse.choices[0].message.content = parsedResponse.content;
            if (parsedResponse.toolCalls) {
                groqResponse.choices[0].message.tool_calls = parsedResponse.toolCalls;
                groqResponse.choices[0].finish_reason = 'tool_calls';
            }
        }

        return groqResponse;
    }

    async createStreamingChatCompletion(request: OpenAIChatRequest): Promise<ReadableStream> {
        const url = `${this.baseUrl}/openai/v1/chat/completions`;

        let processedRequest = {...request};
        const isGptOss = this.isGptOssModel(request.model);

        if (isGptOss) {
            // Handle tool_choice: 'none' - if tools should be disabled, don't include them in harmony format
            const effectiveTools = (request.tool_choice === 'none') ? undefined : request.tools;
            const harmonyPrompt = convertToHarmonyFormat(request.messages, effectiveTools, true, request.tool_choice, request.tools);

            processedRequest.messages = [{role: 'user', content: harmonyPrompt}];

            // Handle tool_choice logic
            if (request.tool_choice === 'none') {
                // Remove tools and tool_choice entirely when explicitly set to 'none'
                processedRequest.tools = undefined;
                processedRequest.tool_choice = undefined;
            } else if (request.tools && !request.tool_choice) {
                // Default to 'auto' when tools are present but no choice specified
                processedRequest.tool_choice = 'auto';
            }
        }

        const body = {
            model: processedRequest.model,
            messages: processedRequest.messages,
            temperature: processedRequest.temperature,
            max_tokens: processedRequest.max_tokens,
            top_p: processedRequest.top_p,
            frequency_penalty: processedRequest.frequency_penalty,
            presence_penalty: processedRequest.presence_penalty,
            stop: processedRequest.stop,
            stream: true,
            tools: processedRequest.tools,
            tool_choice: processedRequest.tool_choice,
            response_format: processedRequest.response_format,
            user: processedRequest.user
        };

        Object.keys(body).forEach(key => {
            if (body[key as keyof typeof body] === undefined) {
                delete body[key as keyof typeof body];
            }
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'User-Agent': 'gpt-oss-harmony-groq/1.0.0'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Groq API error ${response.status}:`, errorText);
            console.error(`Streaming request body length:`, JSON.stringify(body).length);
            console.error(`Streaming request body preview:`, JSON.stringify(body).substring(0, 500));
            throw new Error(`Groq API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        if (isGptOss) {
            return this.processGptOssStream(response.body || new ReadableStream(), request);
        }

        return response.body || new ReadableStream();
    }

    async getModels(): Promise<any> {
        const url = `${this.baseUrl}/openai/v1/models`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'User-Agent': 'gpt-oss-harmony-groq/1.0.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Groq API error ${response.status}:`, errorText);
            throw new Error(`Groq API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    private isGptOssModel(model: string): boolean {
        return model.includes('gpt-oss');
    }

    private processGptOssStream(sourceStream: ReadableStream, originalRequest: OpenAIChatRequest): ReadableStream {
        return new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const decoder = new TextDecoder();
                const reader = sourceStream.getReader();
                let accumulatedContent = '';
                let streamingToolCalls = false;

                try {
                    while (true) {
                        const {done, value} = await reader.read();
                        if (done) break;

                        const text = decoder.decode(value);
                        const lines = text.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    const content = data.choices?.[0]?.delta?.content;
                                    const toolCalls = data.choices?.[0]?.delta?.tool_calls;

                                    if (content) {
                                        accumulatedContent += content;
                                        controller.enqueue(encoder.encode(line + '\n'));
                                    } else {
                                        controller.enqueue(encoder.encode(line + '\n'));
                                    }

                                    // Log any tool calls detected in GPT-OSS stream
                                    if (toolCalls) {
                                        streamingToolCalls = true;
                                        console.log('🚨 TOOL CALLS DETECTED IN GPT-OSS STREAM:', JSON.stringify(toolCalls, null, 2));
                                        console.log('🔍 Current content so far:', accumulatedContent.substring(0, 200));
                                        console.log('🔧 Original request tool_choice:', originalRequest.tool_choice);
                                        console.log('🔧 Original request had tools:', !!originalRequest.tools);
                                    }
                                } catch (e) {
                                    controller.enqueue(encoder.encode(line + '\n'));
                                }
                            } else if (line === 'data: [DONE]') {
                                if (accumulatedContent) {
                                    console.log('📝 GPT-OSS stream completed, analyzing final content...');
                                    console.log('📊 Total content length:', accumulatedContent.length);
                                    console.log('🔍 Tool calls detected during streaming:', streamingToolCalls);
                                    console.log('📄 Final content preview:', accumulatedContent.substring(0, 300) + (accumulatedContent.length > 300 ? '...' : ''));

                                    const parsedResponse = parseHarmonyResponse(accumulatedContent, originalRequest);

                                    if (parsedResponse.toolCalls && parsedResponse.toolCalls.length > 0) {
                                        const toolCallChunk = {
                                            id: `chatcmpl-${Date.now()}`,
                                            object: 'chat.completion.chunk',
                                            created: Math.floor(Date.now() / 1000),
                                            model: originalRequest.model,
                                            choices: [{
                                                index: 0,
                                                delta: {
                                                    tool_calls: parsedResponse.toolCalls
                                                },
                                                finish_reason: 'tool_calls'
                                            }]
                                        };
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolCallChunk)}\n\n`));
                                    }
                                }
                                controller.enqueue(encoder.encode(line + '\n'));
                                break;
                            } else {
                                controller.enqueue(encoder.encode(line + '\n'));
                            }
                        }
                    }

                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }
}
