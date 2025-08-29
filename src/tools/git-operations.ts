import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolFunction } from './tool-registry';

const execAsync = promisify(exec);

export const gitOperationsTool: ToolFunction = {
    name: 'git_operations',
    description: 'Perform Git version control operations like status, add, commit, push, pull, and branch management.',
    parameters: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['status', 'add', 'commit', 'push', 'pull', 'branch', 'diff', 'log', 'checkout', 'merge'],
                description: 'The Git operation to perform'
            },
            files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files to add (for add operation) or specific files to check'
            },
            message: {
                type: 'string',
                description: 'Commit message (required for commit operation)'
            },
            branch: {
                type: 'string',
                description: 'Branch name (for branch, checkout operations)'
            },
            remote: {
                type: 'string',
                description: 'Remote name (default: origin)',
                default: 'origin'
            },
            options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional Git options/flags'
            }
        },
        required: ['operation']
    },
    async execute(args: { 
        operation: string; 
        files?: string[]; 
        message?: string; 
        branch?: string; 
        remote?: string;
        options?: string[];
    }): Promise<any> {
        const { operation, files = [], message, branch, remote = 'origin', options = [] } = args;
        
        try {
            let command = 'git';
            const safeOptions = options.filter(opt => /^[a-zA-Z0-9\-_=.]+$/.test(opt));
            
            switch (operation) {
                case 'status':
                    command += ' status --porcelain';
                    if (safeOptions.length > 0) {
                        command += ` ${safeOptions.join(' ')}`;
                    }
                    break;
                    
                case 'add':
                    if (files.length === 0) {
                        return { success: false, error: 'Files parameter required for add operation' };
                    }
                    const safeFiles = files.filter(file => !/[;&|`$]/.test(file));
                    command += ` add ${safeFiles.map(f => `"${f}"`).join(' ')}`;
                    break;
                    
                case 'commit':
                    if (!message) {
                        return { success: false, error: 'Message parameter required for commit operation' };
                    }
                    const safeMessage = message.replace(/"/g, '\\"');
                    command += ` commit -m "${safeMessage}"`;
                    break;
                    
                case 'push':
                    command += ` push ${remote}`;
                    if (branch) {
                        command += ` ${branch}`;
                    }
                    break;
                    
                case 'pull':
                    command += ` pull ${remote}`;
                    if (branch) {
                        command += ` ${branch}`;
                    }
                    break;
                    
                case 'branch':
                    if (branch) {
                        command += ` branch ${branch}`;
                    } else {
                        command += ' branch -a';
                    }
                    break;
                    
                case 'checkout':
                    if (!branch) {
                        return { success: false, error: 'Branch parameter required for checkout operation' };
                    }
                    command += ` checkout ${branch}`;
                    break;
                    
                case 'diff':
                    command += ' diff';
                    if (files.length > 0) {
                        const safeFiles = files.filter(file => !/[;&|`$]/.test(file));
                        command += ` ${safeFiles.join(' ')}`;
                    }
                    break;
                    
                case 'log':
                    command += ' log --oneline -10';
                    if (safeOptions.length > 0) {
                        command += ` ${safeOptions.join(' ')}`;
                    }
                    break;
                    
                case 'merge':
                    if (!branch) {
                        return { success: false, error: 'Branch parameter required for merge operation' };
                    }
                    command += ` merge ${branch}`;
                    break;
                    
                default:
                    return { success: false, error: `Unsupported Git operation: ${operation}` };
            }
            
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000,
                maxBuffer: 1024 * 1024
            });
            
            return {
                success: true,
                operation,
                command: command.replace(/"/g, ''), // Remove quotes for display
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                files_affected: files,
                branch_info: branch
            };
            
        } catch (error: any) {
            return {
                success: false,
                operation,
                error: error.message || String(error),
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || '',
                exit_code: error.code
            };
        }
    }
};
