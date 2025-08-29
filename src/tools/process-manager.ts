import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import { cwd as processCwd, env as processEnv } from 'process';
import type { ToolFunction } from './tool-registry';

const execAsync = promisify(exec);

// Store running processes
const runningProcesses = new Map<string, ChildProcess>();

export const processManagerTool: ToolFunction = {
    name: 'process_manager',
    description: 'Manage system processes - start servers, run builds, execute tests, and monitor running processes.',
    parameters: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['start', 'stop', 'status', 'list', 'logs', 'kill', 'run'],
                description: 'The process operation to perform'
            },
            command: {
                type: 'string',
                description: 'Command to execute (for start/run operations)'
            },
            name: {
                type: 'string',
                description: 'Process name/identifier (for stop/status/logs operations)'
            },
            background: {
                type: 'boolean',
                description: 'Run process in background (default: true for start, false for run)',
                default: true
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds for run operations (default: 30000)',
                minimum: 1000,
                maximum: 300000,
                default: 30000
            },
            env: {
                type: 'object',
                description: 'Environment variables to set for the process'
            },
            cwd: {
                type: 'string',
                description: 'Working directory for the process (default: current directory)'
            }
        },
        required: ['operation']
    },
    async execute(args: { 
        operation: string; 
        command?: string; 
        name?: string; 
        background?: boolean;
        timeout?: number;
        env?: Record<string, string>;
        cwd?: string;
    }): Promise<any> {
        const { operation, command, name, background = true, timeout = 30000, env = {}, cwd } = args;
        
        try {
            switch (operation) {
                case 'start':
                    if (!command) {
                        return { success: false, error: 'Command parameter required for start operation' };
                    }
                    
                    const processName = name || `proc_${Date.now()}`;
                    const envVars = { ...processEnv, ...env };
                    
                    const spawnedProcess = spawn('sh', ['-c', command], {
                        detached: background,
                        stdio: background ? 'pipe' : 'inherit',
                        env: envVars,
                        cwd: cwd || processCwd()
                    });
                    
                    runningProcesses.set(processName, spawnedProcess);
                    
                    if (background) {
                        spawnedProcess.unref();
                    }
                    
                    return {
                        success: true,
                        operation: 'start',
                        process_name: processName,
                        pid: spawnedProcess.pid,
                        command,
                        background,
                        message: `Process started ${background ? 'in background' : 'in foreground'}`
                    };
                    
                case 'run':
                    if (!command) {
                        return { success: false, error: 'Command parameter required for run operation' };
                    }
                    
                    const { stdout, stderr } = await execAsync(command, {
                        timeout: Math.min(timeout, 300000),
                        maxBuffer: 1024 * 1024,
                        env: { ...processEnv, ...env },
                        cwd: cwd || processCwd()
                    });
                    
                    return {
                        success: true,
                        operation: 'run',
                        command,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        execution_time: `< ${timeout}ms`
                    };
                    
                case 'stop':
                    if (!name) {
                        return { success: false, error: 'Name parameter required for stop operation' };
                    }
                    
                    const targetProcess = runningProcesses.get(name);
                    if (!targetProcess) {
                        return { success: false, error: `Process '${name}' not found` };
                    }
                    
                    targetProcess.kill('SIGTERM');
                    runningProcesses.delete(name);
                    
                    return {
                        success: true,
                        operation: 'stop',
                        process_name: name,
                        message: 'Process stopped successfully'
                    };
                    
                case 'kill':
                    if (!name) {
                        return { success: false, error: 'Name parameter required for kill operation' };
                    }
                    
                    const processToKill = runningProcesses.get(name);
                    if (!processToKill) {
                        return { success: false, error: `Process '${name}' not found` };
                    }
                    
                    processToKill.kill('SIGKILL');
                    runningProcesses.delete(name);
                    
                    return {
                        success: true,
                        operation: 'kill',
                        process_name: name,
                        message: 'Process killed successfully'
                    };
                    
                case 'status':
                    if (!name) {
                        return { success: false, error: 'Name parameter required for status operation' };
                    }
                    
                    const statusProcess = runningProcesses.get(name);
                    if (!statusProcess) {
                        return { success: false, error: `Process '${name}' not found` };
                    }
                    
                    return {
                        success: true,
                        operation: 'status',
                        process_name: name,
                        pid: statusProcess.pid,
                        killed: statusProcess.killed,
                        exit_code: statusProcess.exitCode,
                        signal: statusProcess.signalCode
                    };
                    
                case 'list':
                    const processes = Array.from(runningProcesses.entries()).map(([name, proc]) => ({
                        name,
                        pid: proc.pid,
                        killed: proc.killed,
                        exit_code: proc.exitCode,
                        signal: proc.signalCode
                    }));
                    
                    return {
                        success: true,
                        operation: 'list',
                        processes,
                        count: processes.length
                    };
                    
                case 'logs':
                    return {
                        success: false,
                        error: 'Logs operation not yet implemented - use system logs or redirect output to files'
                    };
                    
                default:
                    return { success: false, error: `Unsupported process operation: ${operation}` };
            }
            
        } catch (error: any) {
            return {
                success: false,
                operation,
                error: error.message || String(error),
                timeout_exceeded: error.killed && error.signal === 'SIGTERM'
            };
        }
    }
};
