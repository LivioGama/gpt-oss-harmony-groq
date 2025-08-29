import { load_harmony_encoding } from 'openai-harmony';
import { logInfo } from './logger';
import type { OpenAIMessage, OpenAITool, OpenAIToolCall } from './types';

let harmonyEncoding: any = null;

async function getHarmonyEncoding() {
    if (!harmonyEncoding) {
        harmonyEncoding = await load_harmony_encoding("HarmonyGptOss");
        logInfo('Harmony encoding loaded successfully');
    }
    return harmonyEncoding;
}

export async function convertToHarmonyFormat(
    messages: OpenAIMessage[],
    tools?: OpenAITool[],
    addGenerationPrompt: boolean = true,
    toolChoice?: string | { type: string; function?: { name: string } }
): Promise<string> {
    const encoding = await getHarmonyEncoding();
    
    // Convert OpenAI messages to Harmony format
    const harmonyMessages = messages.map(msg => ({
        role: msg.role === 'tool' ? 'user' : msg.role, // Tool responses become user messages
        content: typeof msg.content === 'string' ? 
            [{ type: 'text', text: msg.content }] : 
            [{ type: 'text', text: String(msg.content || '') }]
    }));
    
    // Add developer message with tools if provided
    if (tools && tools.length > 0 && toolChoice !== 'none') {
        const toolsText = tools.map(tool => 
            `- ${tool.function.name}: ${tool.function.description || 'No description'}`
        ).join('\n');
        
        const developerMessage = {
            role: 'system' as const,
            content: [{
                type: 'text',
                text: `You have access to the following tools:\n${toolsText}\n\nWhen using tools, format your calls as: <|tool_call|>function_name({"param": "value"})<|end_tool_call|>`
            }]
        };
        
        // Insert after system message if exists, otherwise at beginning
        const systemIndex = harmonyMessages.findIndex(m => m.role === 'system');
        if (systemIndex >= 0) {
            harmonyMessages.splice(systemIndex + 1, 0, developerMessage);
        } else {
            harmonyMessages.unshift(developerMessage);
        }
    }
    
    const conversation = { messages: harmonyMessages };
    const result = encoding.renderConversation(conversation, { auto_drop_analysis: false });
    return encoding.decodeUtf8(result);
}

export async function parseHarmonyResponse(
    content: string,
    originalRequest?: any
): Promise<{
    content: string;
    toolCalls?: OpenAIToolCall[];
    finishReason: 'stop' | 'tool_calls';
}> {
    // Extract tool calls using regex (keep this simple)
    const toolCallPattern = /<\|tool_call\|>(\w+)\(([^)]*)\)<\|end_tool_call\|>/g;
    const toolCalls: OpenAIToolCall[] = [];
    let match;
    
    while ((match = toolCallPattern.exec(content)) !== null) {
        const [, functionName, argsString] = match;
        
        let parsedArgs = {};
        let finalArgsString = '{}';
        
        if (argsString && argsString.trim()) {
            try {
                // Try to parse the JSON
                parsedArgs = JSON.parse(argsString);
                finalArgsString = JSON.stringify(parsedArgs);
            } catch (parseError) {
                const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
                
                // Try to fix common JSON issues
                let fixedArgs = argsString.trim();
                
                // Fix unescaped quotes and common issues
                fixedArgs = fixedArgs
                    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to property names
                    .replace(/:\s*([^",{\[\]}\s][^",{\[\]]*[^",{\[\]}\s])\s*([,}])/g, ':"$1"$2') // Quote unquoted string values
                    .replace(/,\s*}/g, '}') // Remove trailing commas
                    .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
                
                try {
                    parsedArgs = JSON.parse(fixedArgs);
                    finalArgsString = JSON.stringify(parsedArgs);
                } catch (secondError) {
                    finalArgsString = '{}';
                }
            }
        }
        
        toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
                name: functionName,
                arguments: finalArgsString
            }
        });
    }
    
    // Clean content by removing tool calls and harmony markers
    const cleanContent = content
        .replace(toolCallPattern, '')
        .replace(/<\|start\|>/g, '')
        .replace(/<\|end\|>/g, '')
        .replace(/<\|message\|>/g, '')
        .replace(/^assistant\s*/g, '')
        .trim();
    
    return {
        content: cleanContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
    };
}
