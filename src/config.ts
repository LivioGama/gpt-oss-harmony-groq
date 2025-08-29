import { readFileSync } from 'node:fs';

export const loadEnvFile = () => {
    try {
        const envContent = readFileSync('.env', 'utf-8');
        const envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                acc[key.trim()] = value.trim();
            }
            return acc;
        }, {} as Record<string, string>);

        for (const [key, value] of Object.entries(envVars)) {
            process.env[key] = value;
        }
    } catch (error) {
        console.warn('Could not load .env file:', (error as Error).message);
    }
};

export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const PORT = Number(process.env.PORT) || 3307;
export const GROQ_HOST = 'https://api.groq.com';
export const MODEL_NAME = process.env.MODEL_NAME || 'gpt-oss-20b';
export const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 2048;
export const TEMPERATURE = Number(process.env.TEMPERATURE) || 0.7;

export const KNOWN_ENDPOINTS = [
    {method: 'POST', path: '/v1/chat/completions'},
    {method: 'GET', path: '/v1/models'},
    {method: 'POST', path: '/v1/completions'},
    {method: 'POST', path: '/v1/embeddings'}
];
