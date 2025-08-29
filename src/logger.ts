import {appendFileSync} from 'node:fs';

const LOG_FILE = 'gpt-oss-harmony-groq.log';

const ensureLogFile = () => {
    // Log file will be created in the project root
};

const formatTimestamp = () => new Date().toISOString();

export const logInfo = (message: string, ...args: any[]) => {
    const timestamp = formatTimestamp();
    const logEntry = `[${timestamp}] INFO: ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;

    console.log(`[INFO] ${message}`, ...args);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
};

export const logError = (message: string, error?: any) => {
    const timestamp = formatTimestamp();
    const errorDetails = error ? {
        message: error.message || error,
        stack: error.stack,
        name: error.name
    } : {};

    const logEntry = `[${timestamp}] ERROR: ${message} ${Object.keys(errorDetails).length > 0 ? JSON.stringify(errorDetails) : ''}\n`;

    console.error(`[ERROR] ${message}`, error);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (logError) {
        console.error('Failed to write to log file:', logError);
    }
};

export const logRequest = (requestId: string, method: string, path: string, userAgent?: string) => {
    const timestamp = formatTimestamp();
    const logEntry = `[${timestamp}] REQUEST: ${requestId} ${method} ${path} - User-Agent: ${userAgent || 'unknown'}\n`;

    console.log(`[${timestamp}] ${requestId} ${method} ${path} - User-Agent: ${userAgent || 'unknown'}`);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
};

export const logResponse = (requestId: string, status: number, duration: number) => {
    const timestamp = formatTimestamp();
    const logEntry = `[${timestamp}] RESPONSE: ${requestId} Status: ${status} Duration: ${duration}ms\n`;

    console.log(`[${timestamp}] ${requestId} Response: ${status} (${duration}ms)`);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
};

const safeStringify = (obj: any, maxLength: number = 50000): string => {
    try {
        const str = JSON.stringify(obj, null, 2);
        if (str.length > maxLength) {
            const summary = {
                model: obj.model || 'unknown',
                messageCount: Array.isArray(obj.messages) ? obj.messages.length : 0,
                hasTools: !!obj.tools,
                toolChoice: obj.tool_choice || 'none',
                totalLength: str.length,
                preview: str.substring(0, 1000) + '...',
                fullRequest: str
            };
            return JSON.stringify(summary);
        }
        return str;
    } catch (error) {
        return `[Error stringifying object: ${error instanceof Error ? error.message : 'unknown error'}]`;
    }
};

export const logGroqRequest = (requestId: string, request: any) => {
    const timestamp = formatTimestamp();
    const logEntry = `[${timestamp}] GROQ_REQUEST: ${requestId} ${safeStringify(request)}\n`;

    console.log(`[GROQ] Request ${requestId}:`, request);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
};

export const logGroqResponse = (requestId: string, response: any) => {
    const timestamp = formatTimestamp();
    const logEntry = `[${timestamp}] GROQ_RESPONSE: ${requestId} ${safeStringify(response)}\n`;

    console.log(`[GROQ] Response ${requestId}:`, response);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
};

export const logTransformersRequest = (requestId: string, prompt: string) => {
    const timestamp = formatTimestamp();
    const logEntry = `[${timestamp}] TRANSFORMERS_REQUEST: ${requestId} Prompt length: ${prompt.length}\n`;

    console.log(`[TRANSFORMERS] Request ${requestId}: Prompt length ${prompt.length}`);

    try {
        appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
};
