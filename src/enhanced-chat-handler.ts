import { ChatHandler } from './chat-handler';
import { logError, logInfo } from './logger';
import { defaultToolExecutor, type ToolExecutor } from './tools/tool-executor';
import type { OpenAIChatRequest, OpenAIChatResponse, OpenAIMessage, OpenAITool } from './types';

export interface EnhancedChatOptions {
    enableAutoToolExecution?: boolean;
    maxToolIterations?: number;
    includeBuiltInTools?: boolean;
    customTools?: OpenAITool[];
    toolExecutor?: ToolExecutor;
}

export class EnhancedChatHandler extends ChatHandler {
    private toolExecutor: ToolExecutor;
    private enableAutoToolExecution: boolean;
    private maxToolIterations: number;
    private includeBuiltInTools: boolean;
    private customTools: OpenAITool[];

    constructor(
        groqApiKey?: string,
        options: EnhancedChatOptions = {}
    ) {
        super(groqApiKey);
        
        this.toolExecutor = options.toolExecutor || defaultToolExecutor;
        this.enableAutoToolExecution = options.enableAutoToolExecution ?? true;
        this.maxToolIterations = options.maxToolIterations ?? 5;
        this.includeBuiltInTools = options.includeBuiltInTools ?? true;
        this.customTools = options.customTools || [];

        logInfo('EnhancedChatHandler initialized', {
            autoToolExecution: this.enableAutoToolExecution,
            maxIterations: this.maxToolIterations,
            builtInTools: this.includeBuiltInTools,
            customToolsCount: this.customTools.length
        });
    }

    async handleChatCompletion(
        request: OpenAIChatRequest,
        userAgent?: string
    ): Promise<OpenAIChatResponse> {
        const enhancedRequest = this.enhanceRequestWithTools(request);
        
        if (!this.enableAutoToolExecution || enhancedRequest.tool_choice === 'none') {
            return super.handleChatCompletion(enhancedRequest, userAgent);
        }

        return this.handleChatCompletionWithTools(enhancedRequest, userAgent);
    }

    private async handleChatCompletionWithTools(
        request: OpenAIChatRequest,
        userAgent?: string
    ): Promise<OpenAIChatResponse> {
        let currentMessages = [...request.messages];
        let iterations = 0;

        while (iterations < this.maxToolIterations) {
            iterations++;
            
            const currentRequest = {
                ...request,
                messages: currentMessages
            };

            logInfo(`Tool execution iteration ${iterations}`, {
                messageCount: currentMessages.length,
                hasTools: !!(currentRequest.tools && currentRequest.tools.length > 0)
            });

            const response = await super.handleChatCompletion(currentRequest, userAgent);
            
            const assistantMessage = response.choices[0]?.message;
            if (!assistantMessage) {
                logError('No assistant message in response');
                return response;
            }

            currentMessages.push(assistantMessage);

            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                logInfo(`Executing ${assistantMessage.tool_calls.length} tool calls`, {
                    iteration: iterations,
                    tool_names: assistantMessage.tool_calls.map(tc => tc.function.name)
                });

                const toolResults = await this.toolExecutor.executeToolCalls(assistantMessage.tool_calls);

                for (const result of toolResults) {
                    const toolMessage: OpenAIMessage = {
                        role: 'tool',
                        tool_call_id: result.tool_call_id,
                        name: result.function_name,
                        content: result.success 
                            ? JSON.stringify(result.result, null, 2)
                            : `Error: ${result.error}`
                    };
                    currentMessages.push(toolMessage);
                }

                continue;
            }

            logInfo(`Tool execution completed after ${iterations} iterations`);
            return {
                ...response,
                choices: [{
                    ...response.choices[0],
                    message: {
                        ...assistantMessage,
                        content: assistantMessage.content
                    }
                }]
            };
        }

        logError(`Maximum tool iterations (${this.maxToolIterations}) reached`);
        
        const finalRequest = {
            ...request,
            messages: [
                ...currentMessages,
                {
                    role: 'system' as const,
                    content: 'Maximum tool execution iterations reached. Please provide a final response without using more tools.'
                }
            ],
            tool_choice: 'none'
        };

        return super.handleChatCompletion(finalRequest, userAgent);
    }

    async handleStreamingChatCompletion(
        request: OpenAIChatRequest,
        userAgent?: string
    ): Promise<ReadableStream> {
        const enhancedRequest = this.enhanceRequestWithTools(request);
        
        if (!this.enableAutoToolExecution || enhancedRequest.tool_choice === 'none') {
            return super.handleStreamingChatCompletion(enhancedRequest, userAgent);
        }

        logInfo('Streaming with tool support - auto-execution disabled for streaming');
        return super.handleStreamingChatCompletion(enhancedRequest, userAgent);
    }

    private enhanceRequestWithTools(request: OpenAIChatRequest): OpenAIChatRequest {
        if (request.tool_choice === 'none' || (!this.includeBuiltInTools && this.customTools.length === 0)) {
            return request;
        }

        const availableTools: OpenAITool[] = [];

        if (this.includeBuiltInTools) {
            availableTools.push(...this.toolExecutor.getAvailableTools());
        }

        if (this.customTools.length > 0) {
            availableTools.push(...this.customTools);
        }

        const existingTools = request.tools || [];
        const allTools = [...existingTools, ...availableTools];

        const uniqueTools = allTools.filter((tool, index, self) => 
            index === self.findIndex(t => t.function.name === tool.function.name)
        );

        return {
            ...request,
            tools: uniqueTools.length > 0 ? uniqueTools : undefined,
            tool_choice: request.tool_choice || (uniqueTools.length > 0 ? 'auto' : undefined)
        };
    }

    getAvailableTools(): OpenAITool[] {
        const tools: OpenAITool[] = [];
        
        if (this.includeBuiltInTools) {
            tools.push(...this.toolExecutor.getAvailableTools());
        }
        
        tools.push(...this.customTools);
        
        return tools;
    }

    addCustomTool(tool: OpenAITool): void {
        this.customTools.push(tool);
        logInfo(`Added custom tool: ${tool.function.name}`);
    }

    removeCustomTool(toolName: string): boolean {
        const initialLength = this.customTools.length;
        this.customTools = this.customTools.filter(tool => tool.function.name !== toolName);
        const removed = this.customTools.length < initialLength;
        
        if (removed) {
            logInfo(`Removed custom tool: ${toolName}`);
        }
        
        return removed;
    }

    setAutoToolExecution(enabled: boolean): void {
        this.enableAutoToolExecution = enabled;
        logInfo(`Auto tool execution ${enabled ? 'enabled' : 'disabled'}`);
    }

    setMaxToolIterations(max: number): void {
        this.maxToolIterations = Math.max(1, Math.min(max, 10));
        logInfo(`Max tool iterations set to: ${this.maxToolIterations}`);
    }

    getToolExecutionStats() {
        return {
            autoExecutionEnabled: this.enableAutoToolExecution,
            maxIterations: this.maxToolIterations,
            builtInToolsEnabled: this.includeBuiltInTools,
            customToolsCount: this.customTools.length,
            availableToolsCount: this.getAvailableTools().length,
            currentExecutions: this.toolExecutor.getCurrentExecutionCount(),
            maxConcurrentExecutions: this.toolExecutor.getMaxConcurrentExecutions()
        };
    }
}
