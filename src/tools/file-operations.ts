import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { cwd } from 'process';
import type { ToolFunction } from './tool-registry';

export const fileOperationsTool: ToolFunction = {
    name: 'file_operations',
    description: 'Perform file system operations like reading, writing, and listing files. Restricted to safe directories.',
    parameters: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['read', 'write', 'list', 'exists'],
                description: 'The file operation to perform'
            },
            path: {
                type: 'string',
                description: 'The file or directory path (relative to current working directory)'
            },
            content: {
                type: 'string',
                description: 'Content to write (required for write operation)'
            },
            encoding: {
                type: 'string',
                enum: ['utf8', 'base64'],
                description: 'File encoding (default: utf8)'
            }
        },
        required: ['operation', 'path']
    },
    async execute(args: { operation: string; path: string; content?: string; encoding?: string }): Promise<any> {
        const { operation, path, content, encoding = 'utf8' } = args;
        
        const safePath = resolve(cwd(), path);
        const workingDir = cwd();
        
        if (!safePath.startsWith(workingDir)) {
            throw new Error('Access denied: Path must be within the current working directory');
        }
        
        try {
            switch (operation) {
                case 'read':
                    if (!existsSync(safePath)) {
                        return { success: false, error: 'File does not exist' };
                    }
                    
                    const stats = statSync(safePath);
                    if (stats.isDirectory()) {
                        return { success: false, error: 'Path is a directory, use list operation instead' };
                    }
                    
                    if (stats.size > 1024 * 1024) { // 1MB limit
                        return { success: false, error: 'File too large (max 1MB)' };
                    }
                    
                    const fileContent = readFileSync(safePath, encoding as any);
                    return {
                        success: true,
                        path: safePath,
                        content: fileContent,
                        size: stats.size,
                        encoding
                    };
                    
                case 'write':
                    if (!content) {
                        return { success: false, error: 'Content is required for write operation' };
                    }
                    
                    writeFileSync(safePath, content, encoding as any);
                    return {
                        success: true,
                        path: safePath,
                        message: 'File written successfully',
                        size: Buffer.byteLength(content, encoding as any)
                    };
                    
                case 'list':
                    if (!existsSync(safePath)) {
                        return { success: false, error: 'Directory does not exist' };
                    }
                    
                    const dirStats = statSync(safePath);
                    if (!dirStats.isDirectory()) {
                        return { success: false, error: 'Path is not a directory' };
                    }
                    
                    const files = readdirSync(safePath).map(file => {
                        const filePath = join(safePath, file);
                        const fileStats = statSync(filePath);
                        return {
                            name: file,
                            path: filePath,
                            type: fileStats.isDirectory() ? 'directory' : 'file',
                            size: fileStats.isFile() ? fileStats.size : undefined,
                            modified: fileStats.mtime.toISOString()
                        };
                    });
                    
                    return {
                        success: true,
                        path: safePath,
                        files,
                        count: files.length
                    };
                    
                case 'exists':
                    return {
                        success: true,
                        path: safePath,
                        exists: existsSync(safePath),
                        type: existsSync(safePath) ? (statSync(safePath).isDirectory() ? 'directory' : 'file') : null
                    };
                    
                default:
                    return { success: false, error: `Unsupported operation: ${operation}` };
            }
        } catch (error) {
            return {
                success: false,
                error: `File operation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
};

export const writeToFileTool: ToolFunction = {
    name: 'write_to_file',
    description: 'Write content to a file. Compatibility wrapper for file_operations.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file path (relative to current working directory)'
            },
            content: {
                type: 'string',
                description: 'Content to write to the file'
            },
            line_count: {
                type: 'number',
                description: 'Optional line count (ignored, for compatibility)'
            }
        },
        required: ['path', 'content']
    },
    async execute(args: { path: string; content: string; line_count?: number }): Promise<any> {
        return fileOperationsTool.execute({
            operation: 'write',
            path: args.path,
            content: args.content,
            encoding: 'utf8'
        });
    }
};

export const readFileTool: ToolFunction = {
    name: 'read_file',
    description: 'Read the contents of a file. Compatibility wrapper for file_operations.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file path (relative to current working directory)'
            }
        },
        required: ['path']
    },
    async execute(args: { path: string }): Promise<any> {
        return fileOperationsTool.execute({
            operation: 'read',
            path: args.path,
            encoding: 'utf8'
        });
    }
};

export const listFilesTool: ToolFunction = {
    name: 'list_files',
    description: 'List files and directories. Compatibility wrapper for file_operations.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The directory path (relative to current working directory, defaults to current directory)'
            }
        },
        required: []
    },
    async execute(args: { path?: string }): Promise<any> {
        return fileOperationsTool.execute({
            operation: 'list',
            path: args.path || '.',
            encoding: 'utf8'
        });
    }
};

export const appendToFileTool: ToolFunction = {
    name: 'append_to_file',
    description: 'Append content to the end of a file or create it if it doesn\'t exist.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file path (relative to current working directory)'
            },
            content: {
                type: 'string',
                description: 'Content to append to the file'
            }
        },
        required: ['path', 'content']
    },
    async execute(args: { path: string; content: string }): Promise<any> {
        const safePath = resolve(cwd(), args.path);
        const workingDir = cwd();
        
        if (!safePath.startsWith(workingDir)) {
            return { success: false, error: 'Access denied: Path must be within the current working directory' };
        }

        try {
            let existingContent = '';
            if (existsSync(safePath)) {
                const stats = statSync(safePath);
                if (stats.isFile() && stats.size <= 1024 * 1024) {
                    existingContent = readFileSync(safePath, 'utf8');
                }
            }
            
            const newContent = existingContent + args.content;
            writeFileSync(safePath, newContent, 'utf8');
            
            return {
                success: true,
                path: safePath,
                message: 'Content appended successfully',
                size: Buffer.byteLength(newContent, 'utf8')
            };
        } catch (error) {
            return {
                success: false,
                error: `Append operation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
};
