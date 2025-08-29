import type {OpenAIMessage, OpenAITool} from './types';

// Legacy function - now harmony formatting is applied directly in GroqClient for gpt-oss models
export const isHarmonyModel = (model: string): boolean => {
    return false; // All models now go through Groq with automatic harmony formatting
};

export const convertToHarmonyFormat = (
    messages: OpenAIMessage[],
    tools?: OpenAITool[],
    addGenerationPrompt: boolean = true,
    toolChoice?: string | { type: string; function?: { name: string } },
    originalTools?: OpenAITool[]
): string => {
    const hasTools = tools && tools.length > 0;

    // Force the correct behavior for tool_choice: "none" OR when content contains tool descriptions
    const toolChoiceString = typeof toolChoice === 'string' ? toolChoice : toolChoice?.type;
    const contentHasToolDescriptions = messages.some(msg => {
        const content = typeof msg.content === 'string' ? msg.content :
            Array.isArray(msg.content) ? msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('') : String(msg.content || '');
        return content.includes('codebase_search') || content.includes('read_file') || content.includes('Tool Use') || content.includes('<tool_name>');
    });

    let prompt: string;
    if (toolChoiceString === 'none' || (toolChoiceString === undefined && contentHasToolDescriptions)) {
        prompt = '<|system|>\nYou are a helpful AI assistant. ABSOLUTELY CRITICAL: You are FORBIDDEN from using ANY tools, function calls, or XML tags whatsoever. Do NOT use <read_file>, <search_files>, <list_files>, <codebase_search>, or ANY other tool syntax. You MUST respond ONLY with plain text. NO EXCEPTIONS. Tools are completely disabled and unavailable for this request. Any attempt to use tools will result in an error.<|end|>\n';
    } else if (hasTools) {
        prompt = '<|system|>\nYou are a helpful AI assistant that can use tools when needed.<|end|>\n';
    } else {
        prompt = '<|system|>\nYou are a helpful AI assistant.<|end|>\n';
    }

    if (hasTools && toolChoiceString !== 'none') {
        prompt += '<|system|>\nAvailable tools:\n';
        for (const tool of tools) {
            prompt += `- ${tool.function.name}: ${tool.function.description || 'No description'}\n`;
            if (tool.function.parameters) {
                prompt += `  Parameters: ${JSON.stringify(tool.function.parameters)}\n`;
            }
        }
        prompt += '\nWhen using tools, format your calls as: <|tool_call|>function_name({"param": "value"})<|end_tool_call|>\n<|end|>\n';
    }

    for (const message of messages) {
        switch (message.role) {
            case 'system':
                // Skip system messages when tools are disabled to preserve our tool restriction prompt
                if (message.content && !(toolChoiceString === 'none' || (toolChoiceString === undefined && contentHasToolDescriptions))) {
                    const content = typeof message.content === 'string'
                        ? message.content
                        : Array.isArray(message.content)
                            ? message.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
                            : String(message.content);
                    prompt += `<|system|>\n${content}<|end|>\n`;
                }
                break;
            case 'user':
                if (message.content) {
                    const content = typeof message.content === 'string'
                        ? message.content
                        : Array.isArray(message.content)
                            ? message.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
                            : String(message.content);
                    prompt += `<|user|>\n${content}<|end|>\n`;
                }
                break;
            case 'assistant':
                prompt += '<|assistant|>\n';
                if (message.content) {
                    const content = typeof message.content === 'string'
                        ? message.content
                        : Array.isArray(message.content)
                            ? message.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
                            : String(message.content);
                    prompt += content;
                }
                if (message.tool_calls && message.tool_calls.length > 0) {
                    for (const toolCall of message.tool_calls) {
                        prompt += `\n<|tool_call|>${toolCall.function.name}(${toolCall.function.arguments})<|end_tool_call|>`;
                    }
                }
                prompt += '<|end|>\n';
                break;
            case 'tool':
                if (message.content && message.name) {
                    const content = typeof message.content === 'string'
                        ? message.content
                        : Array.isArray(message.content)
                            ? message.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
                            : String(message.content);
                    prompt += `<|tool_result|>\nTool: ${message.name}\nResult: ${content}<|end|>\n`;
                }
                break;
        }
    }

    // Add additional tool restriction for tool_choice: "none" at the end
    if (toolChoiceString === 'none' || (toolChoiceString === undefined && contentHasToolDescriptions)) {
        prompt += '<|system|>\nREMINDER: You are STRICTLY FORBIDDEN from using any tools or function calls. Respond with plain text only.<|end|>\n';
    }

    if (addGenerationPrompt) {
        prompt += '<|assistant|>\n';
    }

    return prompt;
};

export const parseHarmonyResponse = (
    content: string,
    originalRequest: any
): {
    content: string;
    toolCalls?: any[];
    finishReason: 'stop' | 'tool_calls';
} => {
    const toolCallPattern = /<\|tool_call\|>(\w+)\(([^)]*)\)<\|end_tool_call\|>/g;
    const toolCalls: any[] = [];
    let match;

    while ((match = toolCallPattern.exec(content)) !== null) {
        const [, functionName, argsString] = match;
        try {
            const args = argsString ? JSON.parse(argsString) : {};
            toolCalls.push({
                id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'function',
                function: {
                    name: functionName,
                    arguments: JSON.stringify(args)
                }
            });
        } catch (parseError) {
            console.warn('Failed to parse tool call arguments:', parseError);
            toolCalls.push({
                id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'function',
                function: {
                    name: functionName,
                    arguments: argsString || '{}'
                }
            });
        }
    }

    let cleanContent = content.replace(toolCallPattern, '').trim();

    cleanContent = cleanContent
        .replace(/<\|assistant\|>/g, '')
        .replace(/<\|end\|>/g, '')
        .replace(/<\|system\|>/g, '')
        .replace(/<\|user\|>/g, '')
        .replace(/<\|tool_result\|>/g, '')
        .trim();

    return {
        content: cleanContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
    };
};

export const parseHarmonyStreamChunk = (
    content: string,
    chunkIndex: number,
    completionId: string,
    model: string,
    timestamp: number
): any => {
    if (!content) return null;

    return {
        id: completionId,
        object: 'chat.completion.chunk',
        created: timestamp,
        model,
        system_fingerprint: 'fp_harmony_transformers',
        choices: [{
            index: 0,
            delta: {content},
            finish_reason: null
        }]
    };
};
