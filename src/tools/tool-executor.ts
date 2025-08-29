import { logError, logInfo } from '../logger';
import type { OpenAIToolCall } from '../types';
import { defaultToolRegistry, type ToolRegistry } from './tool-registry';

export interface ToolExecutionResult {
    tool_call_id: string;
    function_name: string;
    success: boolean;
    result?: any;
    error?: string;
    execution_time_ms: number;
}

export class ToolExecutor {
    private registry: ToolRegistry;
    private maxExecutionTime: number;
    private maxConcurrentExecutions: number;
    private currentExecutions: number = 0;

    constructor(
        registry: ToolRegistry = defaultToolRegistry,
        maxExecutionTime: number = 30000,
        maxConcurrentExecutions: number = 5
    ) {
        this.registry = registry;
        this.maxExecutionTime = maxExecutionTime;
        this.maxConcurrentExecutions = maxConcurrentExecutions;
    }

    async executeToolCall(toolCall: OpenAIToolCall): Promise<ToolExecutionResult> {
        const startTime = Date.now();
        const { id, function: func } = toolCall;

        logInfo(`Executing tool call: ${func.name}`, {
            tool_call_id: id,
            function_name: func.name,
            arguments: func.arguments
        });



        if (this.currentExecutions >= this.maxConcurrentExecutions) {
            return {
                tool_call_id: id,
                function_name: func.name,
                success: false,
                error: 'Maximum concurrent tool executions reached',
                execution_time_ms: Date.now() - startTime
            };
        }

        this.currentExecutions++;

        try {
            let args: any;
            try {
                args = JSON.parse(func.arguments);
                
                if (args.args && Array.isArray(args.args) && args.args.length > 0) {
                    const firstArg = args.args[0];
                    if (firstArg.file && firstArg.file.path) {
                        args = { path: firstArg.file.path };
                    } else {
                        args = firstArg;
                    }
                }
            } catch (parseError) {
                return {
                    tool_call_id: id,
                    function_name: func.name,
                    success: false,
                    error: `Invalid JSON arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    execution_time_ms: Date.now() - startTime
                };
            }

            const validation = this.registry.validateToolCall(func.name, args);
            if (!validation.valid) {
                return {
                    tool_call_id: id,
                    function_name: func.name,
                    success: false,
                    error: validation.error,
                    execution_time_ms: Date.now() - startTime
                };
            }

            const executionPromise = this.registry.executeTool(func.name, args);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Tool execution timeout')), this.maxExecutionTime);
            });

            const result = await Promise.race([executionPromise, timeoutPromise]);

            const executionTime = Date.now() - startTime;

            logInfo(`Tool call completed successfully: ${func.name}`, {
                tool_call_id: id,
                execution_time_ms: executionTime,
                result_type: typeof result
            });

            return {
                tool_call_id: id,
                function_name: func.name,
                success: true,
                result,
                execution_time_ms: executionTime
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            logError(`Tool call failed: ${func.name}`, {
                tool_call_id: id,
                error: errorMessage,
                execution_time_ms: executionTime
            });

            return {
                tool_call_id: id,
                function_name: func.name,
                success: false,
                error: errorMessage,
                execution_time_ms: executionTime
            };
        } finally {
            this.currentExecutions--;
        }
    }

    async executeToolCalls(toolCalls: OpenAIToolCall[]): Promise<ToolExecutionResult[]> {
        if (toolCalls.length === 0) {
            return [];
        }

        logInfo(`Executing ${toolCalls.length} tool calls`, {
            tool_names: toolCalls.map(tc => tc.function.name)
        });

        const results = await Promise.all(
            toolCalls.map(toolCall => this.executeToolCall(toolCall))
        );

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        logInfo(`Tool execution batch completed`, {
            total: results.length,
            successful: successCount,
            failed: failureCount,
            total_execution_time_ms: Math.max(...results.map(r => r.execution_time_ms))
        });

        return results;
    }

    getAvailableTools() {
        return this.registry.getToolsAsOpenAIFormat();
    }

    getToolByName(name: string) {
        return this.registry.getTool(name);
    }

    registerCustomTool(tool: any) {
        this.registry.registerTool(tool);
    }

    getCurrentExecutionCount(): number {
        return this.currentExecutions;
    }

    getMaxConcurrentExecutions(): number {
        return this.maxConcurrentExecutions;
    }
}

export const defaultToolExecutor = new ToolExecutor();
