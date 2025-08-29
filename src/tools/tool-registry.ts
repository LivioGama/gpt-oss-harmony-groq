import type { OpenAITool } from '../types';
import { calculatorTool } from './calculator';
import { codeExecutionTool } from './code-execution';
import { appendToFileTool, fileOperationsTool, listFilesTool, readFileTool, writeToFileTool } from './file-operations';
import { gitOperationsTool } from './git-operations';
import { httpClientTool } from './http-client';
import {
    applyDiffTool,
    askFollowupQuestionTool,
    attemptCompletionTool,
    executeCommandTool,
    listCodeDefinitionNamesTool,
    searchFilesTool
} from './kilo-compatibility';
import { processManagerTool } from './process-manager';
import { weatherTool } from './weather';
import { webSearchTool } from './web-search';

export interface ToolFunction {
    name: string;
    description: string;
    parameters: any;
    execute: (args: any) => Promise<any>;
}

export class ToolRegistry {
    private tools: Map<string, ToolFunction> = new Map();

    constructor() {
        this.registerBuiltInTools();
    }

    private registerBuiltInTools(): void {
        const builtInTools = [
            // Core tools
            webSearchTool,
            codeExecutionTool,
            fileOperationsTool,
            weatherTool,
            calculatorTool,
            gitOperationsTool,
            httpClientTool,
            processManagerTool,
            // Kilo Code compatibility tools
            writeToFileTool,
            readFileTool,
            listFilesTool,
            appendToFileTool,
            searchFilesTool,
            executeCommandTool,
            listCodeDefinitionNamesTool,
            applyDiffTool,
            askFollowupQuestionTool,
            attemptCompletionTool
        ];

        for (const tool of builtInTools) {
            this.registerTool(tool);
        }
    }

    registerTool(tool: ToolFunction): void {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): ToolFunction | undefined {
        return this.tools.get(name);
    }

    getAllTools(): ToolFunction[] {
        return Array.from(this.tools.values());
    }

    getToolsAsOpenAIFormat(): OpenAITool[] {
        return this.getAllTools().map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    async executeTool(name: string, args: any): Promise<any> {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }

        try {
            return await tool.execute(args);
        } catch (error) {
            throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    validateToolCall(name: string, args: any): { valid: boolean; error?: string } {
        const tool = this.getTool(name);
        if (!tool) {
            return { valid: false, error: `Tool '${name}' not found` };
        }

        try {
            if (tool.parameters?.required) {
                for (const requiredParam of tool.parameters.required) {
                    if (!(requiredParam in args)) {
                        return { 
                            valid: false, 
                            error: `Missing required parameter: ${requiredParam}` 
                        };
                    }
                }
            }
            return { valid: true };
        } catch (error) {
            return { 
                valid: false, 
                error: `Validation error: ${error instanceof Error ? error.message : String(error)}` 
            };
        }
    }
}

export const defaultToolRegistry = new ToolRegistry();
