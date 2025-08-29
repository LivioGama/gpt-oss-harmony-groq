import { exec } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import type { ToolFunction } from './tool-registry';

const execAsync = promisify(exec);

export const codeExecutionTool: ToolFunction = {
    name: 'execute_code',
    description: 'Execute code in various programming languages (JavaScript, Python, Shell). Returns the output or error.',
    parameters: {
        type: 'object',
        properties: {
            language: {
                type: 'string',
                enum: ['javascript', 'python', 'shell', 'bash'],
                description: 'The programming language to execute'
            },
            code: {
                type: 'string',
                description: 'The code to execute'
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 10000, max: 30000)',
                minimum: 1000,
                maximum: 30000
            }
        },
        required: ['language', 'code']
    },
    async execute(args: { language: string; code: string; timeout?: number }): Promise<any> {
        const { language, code, timeout = 10000 } = args;
        
        const safeTimeout = Math.min(timeout, 30000);
        
        try {
            let command: string;
            let tempFile: string | null = null;
            
            switch (language.toLowerCase()) {
                case 'javascript':
                    command = `node -e "${code.replace(/"/g, '\\"')}"`;
                    break;
                    
                case 'python':
                    tempFile = join(tmpdir(), `temp_${Date.now()}.py`);
                    writeFileSync(tempFile, code);
                    command = `python3 "${tempFile}"`;
                    break;
                    
                case 'shell':
                case 'bash':
                    command = code;
                    break;
                    
                default:
                    throw new Error(`Unsupported language: ${language}`);
            }
            
            const { stdout, stderr } = await execAsync(command, {
                timeout: safeTimeout,
                maxBuffer: 1024 * 1024 // 1MB max output
            });
            
            if (tempFile && existsSync(tempFile)) {
                unlinkSync(tempFile);
            }
            
            return {
                language,
                success: true,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                execution_time: `< ${safeTimeout}ms`
            };
            
        } catch (error: any) {
            return {
                language,
                success: false,
                error: error.message || String(error),
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || '',
                execution_time: error.killed ? `> ${safeTimeout}ms (timeout)` : 'unknown'
            };
        }
    }
};
