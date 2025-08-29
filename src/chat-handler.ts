import {GroqClient} from './groq-client';
import {logError, logGroqRequest, logGroqResponse, logInfo} from './logger';
import type {OpenAIChatRequest, OpenAIChatResponse} from './types';

export class ChatHandler {
    private groqClient: GroqClient;

    constructor(groqApiKey?: string) {
        this.groqClient = new GroqClient(groqApiKey);

        logInfo('ChatHandler initialized (Groq-only)', {
            hasGroqKey: !!(groqApiKey || process.env.GROQ_API_KEY)
        });
    }

    async handleChatCompletion(
        request: OpenAIChatRequest,
        userAgent?: string
    ): Promise<OpenAIChatResponse> {
        const validationError = this.validateRequest(request);
        if (validationError) {
            throw new Error(validationError);
        }

        const isClineCompatible = this.detectClineCompatibility(userAgent, request);
        let processedRequest = request;

        if (isClineCompatible) {
            processedRequest = this.enhanceForClineCompatibility(processedRequest);
        }
        return await this.handleGroqCompletion(processedRequest);
    }

    async handleStreamingChatCompletion(
        request: OpenAIChatRequest,
        userAgent?: string
    ): Promise<ReadableStream> {
        const validationError = this.validateRequest(request);
        if (validationError) {
            throw new Error(validationError);
        }

        const isClineCompatible = this.detectClineCompatibility(userAgent, request);
        let processedRequest = request;

        if (isClineCompatible) {
            processedRequest = this.enhanceForClineCompatibility(processedRequest);
        }
        return await this.handleGroqStreaming(processedRequest);
    }

    async getModels(): Promise<any> {
        try {
            const groqModels = await this.groqClient.getModels();
            return groqModels;
        } catch (error) {
            return {
                object: 'list',
                data: [
                    {
                        id: 'openai/gpt-oss-20b',
                        object: 'model',
                        created: Date.now(),
                        owned_by: 'openai-groq'
                    }
                ]
            };
        }
    }

    private generateId(): string {
        return `chatcmpl-${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private validateRequest(request: OpenAIChatRequest): string | null {
        if (!request.model) {
            return 'Model is required';
        }

        if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
            return 'Messages array is required and must not be empty';
        }

        for (const message of request.messages) {
            if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
                return 'Each message must have a valid role';
            }
        }

        return null;
    }

    private detectClineCompatibility(userAgent: string = '', body?: OpenAIChatRequest): boolean {
        const hasCompatibleUserAgent = (
            userAgent.toLowerCase().includes('cline') ||
            userAgent.toLowerCase().includes('roo') ||
            userAgent.toLowerCase().includes('vscode') ||
            userAgent.toLowerCase().includes('cursor') ||
            userAgent.toLowerCase().includes('kilo')
        );

        if (body) {
            const hasToolChoiceNoneWithTools = body.tool_choice === 'none' && body.tools && body.tools.length > 0;
            const hasLargeToolList = body.tools && body.tools.length > 5;
            const hasAskFollowupTool = body.tools && body.tools.some((tool: any) =>
                tool.function?.name === 'ask_followup_question'
            );

            if (hasToolChoiceNoneWithTools || (hasLargeToolList && hasAskFollowupTool)) {
                return true;
            }
        }

        return hasCompatibleUserAgent;
    }

    private enhanceForClineCompatibility(request: OpenAIChatRequest): OpenAIChatRequest {
        const enhanced = {...request};

        if (enhanced.tools && enhanced.tools.length > 10) {
            enhanced.tools = enhanced.tools.slice(0, 10);
        }

        return enhanced;
    }

    private async handleGroqCompletion(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
        const requestId = this.generateId();
        // Note: Logging the input request here, actual processed request may differ in GroqClient
        logGroqRequest(requestId, request);

        const groqResponse = await this.groqClient.createChatCompletion(request);
        logGroqResponse(requestId, groqResponse);

        logInfo(`Groq completion received for ${requestId}`, {
            model: groqResponse.model,
            finishReason: groqResponse.choices?.[0]?.finish_reason,
            hasContent: !!groqResponse.choices?.[0]?.message?.content,
            hasToolCalls: !!groqResponse.choices?.[0]?.message?.tool_calls,
            usage: groqResponse.usage
        });

        const response = {
            id: groqResponse.id,
            object: 'chat.completion' as const,
            created: groqResponse.created,
            model: groqResponse.model,
            system_fingerprint: 'fp_groq_harmony',
            choices: groqResponse.choices.map(choice => ({
                index: choice.index,
                message: {
                    role: choice.message.role as any,
                    content: choice.message.content,
                    tool_calls: choice.message.tool_calls
                },
                finish_reason: choice.finish_reason as any
            })),
            usage: groqResponse.usage
        };

        logInfo(`Groq completion finished for ${requestId}`, {
            finishReason: response.choices[0]?.finish_reason,
            hasToolCalls: !!response.choices[0]?.message?.tool_calls
        });

        return response;
    }

    private async handleGroqStreaming(request: OpenAIChatRequest): Promise<ReadableStream> {
        const requestId = this.generateId();
        logGroqRequest(requestId, {...request, stream: true});

        const stream = await this.groqClient.createStreamingChatCompletion(request);
        logInfo(`Started Groq streaming for ${requestId}`);

        return new ReadableStream({
            start(controller) {
                const reader = stream.getReader();
                let accumulatedResponse = '';
                let accumulatedContent = '';
                let toolCallsDetected = false;

                const processChunk = async () => {
                    try {
                        while (true) {
                            const {done, value} = await reader.read();
                            if (done) {
                                if (accumulatedResponse) {
                                    logInfo(`Groq streaming completed for ${requestId}`, {
                                        responseLength: accumulatedResponse.length,
                                        contentLength: accumulatedContent.length,
                                        toolCallsDetected,
                                        contentPreview: accumulatedContent.substring(0, 200) + (accumulatedContent.length > 200 ? '...' : '')
                                    });
                                }
                                controller.close();
                                break;
                            }

                            const chunk = new TextDecoder().decode(value);
                            accumulatedResponse += chunk;

                            // Parse streaming chunks to detect tool calls and content
                            const lines = chunk.split('\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        const deltaContent = data.choices?.[0]?.delta?.content;
                                        const toolCalls = data.choices?.[0]?.delta?.tool_calls;

                                        if (deltaContent) {
                                            accumulatedContent += deltaContent;
                                        }

                                        if (toolCalls) {
                                            toolCallsDetected = true;
                                            logInfo(`Tool calls detected in stream for ${requestId}`, {
                                                toolCalls,
                                                currentContent: accumulatedContent.substring(0, 100)
                                            });
                                        }
                                    } catch (e) {
                                        // Ignore JSON parse errors for non-JSON lines
                                    }
                                }
                            }

                            controller.enqueue(value);
                        }
                    } catch (error) {
                        logError(`Groq streaming error for ${requestId}`, error);
                        controller.error(error);
                    }
                };

                processChunk();
            }
        });
    }
}
