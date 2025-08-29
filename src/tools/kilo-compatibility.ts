import { exec } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { cwd } from 'process';
import { promisify } from 'util';
import type { ToolFunction } from './tool-registry';

const execAsync = promisify(exec);

export const searchFilesTool: ToolFunction = {
    name: 'search_files',
    description: 'Search for patterns across multiple files in the project.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'The search pattern or text to find'
            },
            path: {
                type: 'string',
                description: 'The directory path to search in (defaults to current directory)'
            },
            file_pattern: {
                type: 'string',
                description: 'File pattern to filter files (e.g., "*.ts", "*.js")'
            }
        },
        required: ['pattern']
    },
    async execute(args: { pattern: string; path?: string; file_pattern?: string }): Promise<any> {
        const searchPath = resolve(cwd(), args.path || '.');
        const workingDir = cwd();
        
        if (!searchPath.startsWith(workingDir)) {
            return { success: false, error: 'Access denied: Path must be within the current working directory' };
        }

        try {
            const results: any[] = [];
            const searchInDirectory = (dirPath: string, depth: number = 0) => {
                if (depth > 10) return; // Prevent infinite recursion
                
                const items = readdirSync(dirPath);
                for (const item of items) {
                    if (item.startsWith('.')) continue; // Skip hidden files
                    
                    const itemPath = join(dirPath, item);
                    const stats = statSync(itemPath);
                    
                    if (stats.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
                            searchInDirectory(itemPath, depth + 1);
                        }
                    } else if (stats.isFile()) {
                        if (args.file_pattern) {
                            const pattern = args.file_pattern.replace(/\*/g, '.*');
                            if (!new RegExp(pattern).test(item)) continue;
                        }
                        
                        if (stats.size > 1024 * 1024) continue; // Skip large files
                        
                        try {
                            const content = readFileSync(itemPath, 'utf8');
                            const lines = content.split('\n');
                            
                            lines.forEach((line, lineNumber) => {
                                if (line.toLowerCase().includes(args.pattern.toLowerCase())) {
                                    results.push({
                                        file: itemPath.replace(workingDir, '.'),
                                        line: lineNumber + 1,
                                        content: line.trim(),
                                        match: args.pattern
                                    });
                                }
                            });
                        } catch {
                            
                        }
                    }
                }
            };
            
            searchInDirectory(searchPath);
            
            return {
                success: true,
                pattern: args.pattern,
                results,
                count: results.length
            };
        } catch (error) {
            return {
                success: false,
                error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
};

export const executeCommandTool: ToolFunction = {
    name: 'execute_command',
    description: 'Execute system commands and programs. Compatibility wrapper for process_manager.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The command to execute'
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 10000)'
            }
        },
        required: ['command']
    },
    async execute(args: { command: string; timeout?: number }): Promise<any> {
        try {
            const timeout = args.timeout || 10000;
            const { stdout, stderr } = await execAsync(args.command, { 
                timeout,
                cwd: cwd(),
                maxBuffer: 1024 * 1024 // 1MB buffer
            });
            
            return {
                success: true,
                command: args.command,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exit_code: 0
            };
        } catch (error: any) {
            return {
                success: false,
                command: args.command,
                error: error.message,
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || '',
                exit_code: error.code || 1
            };
        }
    }
};

export const listCodeDefinitionNamesTool: ToolFunction = {
    name: 'list_code_definition_names',
    description: 'Create a structural map of code definitions (functions, classes, etc.).',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The directory path to analyze (defaults to current directory)'
            }
        },
        required: []
    },
    async execute(args: { path?: string }): Promise<any> {
        const searchPath = resolve(cwd(), args.path || '.');
        const workingDir = cwd();
        
        if (!searchPath.startsWith(workingDir)) {
            return { success: false, error: 'Access denied: Path must be within the current working directory' };
        }

        try {
            const definitions: any[] = [];
            const analyzeDirectory = (dirPath: string, depth: number = 0) => {
                if (depth > 10) return;
                
                const items = readdirSync(dirPath);
                for (const item of items) {
                    if (item.startsWith('.')) continue;
                    
                    const itemPath = join(dirPath, item);
                    const stats = statSync(itemPath);
                    
                    if (stats.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
                            analyzeDirectory(itemPath, depth + 1);
                        }
                    } else if (stats.isFile() && /\.(ts|js|py|java|cpp|c|h)$/.test(item)) {
                        if (stats.size > 1024 * 1024) continue;
                        
                        try {
                            const content = readFileSync(itemPath, 'utf8');
                            const lines = content.split('\n');
                            
                            lines.forEach((line, lineNumber) => {
                                // Simple regex patterns for common definitions
                                const patterns = [
                                    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
                                    /(?:export\s+)?class\s+(\w+)/,
                                    /(?:export\s+)?interface\s+(\w+)/,
                                    /(?:export\s+)?type\s+(\w+)/,
                                    /(?:export\s+)?const\s+(\w+)\s*=/,
                                    /def\s+(\w+)\s*\(/,  // Python
                                    /class\s+(\w+)\s*[:{]/,  // Python/Java
                                ];
                                
                                for (const pattern of patterns) {
                                    const match = line.match(pattern);
                                    if (match) {
                                        definitions.push({
                                            name: match[1],
                                            type: pattern.source.includes('function') ? 'function' :
                                                  pattern.source.includes('class') ? 'class' :
                                                  pattern.source.includes('interface') ? 'interface' :
                                                  pattern.source.includes('type') ? 'type' :
                                                  pattern.source.includes('def') ? 'function' : 'variable',
                                            file: itemPath.replace(workingDir, '.'),
                                            line: lineNumber + 1
                                        });
                                        break;
                                    }
                                }
                            });
                        } catch {
                            
                        }
                    }
                }
            };
            
            analyzeDirectory(searchPath);
            
            return {
                success: true,
                path: searchPath.replace(workingDir, '.'),
                definitions,
                count: definitions.length
            };
        } catch (error) {
            return {
                success: false,
                error: `Code analysis failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
};

export const applyDiffTool: ToolFunction = {
    name: 'apply_diff',
    description: 'Apply precise changes to code using diff format.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file path to apply changes to'
            },
            diff: {
                type: 'string',
                description: 'The diff content to apply'
            }
        },
        required: ['path', 'diff']
    },
    async execute(args: { path: string; diff: string }): Promise<any> {
        // For now, this is a placeholder that returns an error suggesting to use write_to_file instead
        return {
            success: false,
            error: 'apply_diff is not yet implemented. Please use write_to_file for file modifications.',
            suggestion: 'Use write_to_file tool to rewrite the entire file with your changes.'
        };
    }
};

export const askFollowupQuestionTool: ToolFunction = {
    name: 'ask_followup_question',
    description: 'Ask the user for additional information or clarification.',
    parameters: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'The question to ask the user'
            }
        },
        required: ['question']
    },
    async execute(args: { question: string }): Promise<any> {
        return {
            success: true,
            question: args.question,
            message: 'Question has been presented to the user. Waiting for response.',
            type: 'followup_question'
        };
    }
};

export const attemptCompletionTool: ToolFunction = {
    name: 'attempt_completion',
    description: 'Signal that the current task has been completed.',
    parameters: {
        type: 'object',
        properties: {
            result: {
                type: 'string',
                description: 'Summary of what was completed'
            }
        },
        required: ['result']
    },
    async execute(args: { result: string }): Promise<any> {
        return {
            success: true,
            result: args.result,
            message: 'Task completion signaled.',
            type: 'completion'
        };
    }
};
