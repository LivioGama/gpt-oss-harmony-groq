export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null | Array<{ type: string; text?: string; [key: string]: any }>;
    name?: string;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
}

export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: any;
    };
}

export interface OpenAIChatRequest {
    model: string;
    messages: OpenAIMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
    tools?: OpenAITool[];
    tool_choice?: string | { type: string; function?: { name: string } };
    response_format?: { type: 'json_object' | 'text' };
    user?: string;
}

export interface OpenAIChatResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    system_fingerprint: string;
    choices: OpenAIChatChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface OpenAIChatChoice {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'tool_calls' | 'length' | null;
}

export interface OpenAIStreamChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    system_fingerprint: string;
    choices: OpenAIStreamChoice[];
}

export interface OpenAIStreamChoice {
    index: number;
    delta: Partial<OpenAIMessage>;
    finish_reason: 'stop' | 'tool_calls' | 'length' | null;
}

export interface GroqResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            tool_calls?: OpenAIToolCall[];
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
