import type { ToolFunction } from './tool-registry';

export const httpClientTool: ToolFunction = {
    name: 'http_client',
    description: 'Make HTTP requests to APIs and web services. Supports GET, POST, PUT, DELETE, PATCH with headers, authentication, and various data formats.',
    parameters: {
        type: 'object',
        properties: {
            method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                description: 'HTTP method to use'
            },
            url: {
                type: 'string',
                description: 'The URL to make the request to'
            },
            headers: {
                type: 'object',
                description: 'HTTP headers to include in the request'
            },
            body: {
                type: 'string',
                description: 'Request body (for POST, PUT, PATCH methods)'
            },
            json: {
                type: 'object',
                description: 'JSON data to send (automatically sets Content-Type to application/json)'
            },
            timeout: {
                type: 'number',
                description: 'Request timeout in milliseconds (default: 10000, max: 30000)',
                minimum: 1000,
                maximum: 30000,
                default: 10000
            },
            follow_redirects: {
                type: 'boolean',
                description: 'Whether to follow HTTP redirects (default: true)',
                default: true
            },
            validate_ssl: {
                type: 'boolean',
                description: 'Whether to validate SSL certificates (default: true)',
                default: true
            }
        },
        required: ['method', 'url']
    },
    async execute(args: { 
        method: string; 
        url: string; 
        headers?: Record<string, string>; 
        body?: string;
        json?: any;
        timeout?: number;
        follow_redirects?: boolean;
        validate_ssl?: boolean;
    }): Promise<any> {
        const { 
            method, 
            url, 
            headers = {}, 
            body, 
            json, 
            timeout = 10000,
            follow_redirects = true,
            validate_ssl = true
        } = args;
        
        try {
            // Validate URL
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(url);
            } catch (urlError) {
                return {
                    success: false,
                    error: `Invalid URL: ${url}`,
                    details: urlError instanceof Error ? urlError.message : String(urlError)
                };
            }
            
            // Security check - only allow HTTP/HTTPS
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return {
                    success: false,
                    error: `Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed.`
                };
            }
            
            // Prepare request options
            const requestHeaders = { ...headers };
            let requestBody: string | undefined;
            
            // Handle JSON data
            if (json !== undefined) {
                requestBody = JSON.stringify(json);
                requestHeaders['Content-Type'] = 'application/json';
            } else if (body !== undefined) {
                requestBody = body;
            }
            
            // Set default User-Agent if not provided
            if (!requestHeaders['User-Agent']) {
                requestHeaders['User-Agent'] = 'GPT-OSS-HTTP-Client/1.0.0';
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Math.min(timeout, 30000));
            
            const startTime = Date.now();
            
            const response = await fetch(url, {
                method: method.toUpperCase(),
                headers: requestHeaders,
                body: ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) ? undefined : requestBody,
                signal: controller.signal,
                redirect: follow_redirects ? 'follow' : 'manual'
            });
            
            clearTimeout(timeoutId);
            const endTime = Date.now();
            
            // Get response headers
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            
            // Get response body
            let responseBody: string;
            let responseJson: any = null;
            
            try {
                responseBody = await response.text();
                
                // Try to parse as JSON if content-type suggests it
                const contentType = responseHeaders['content-type'] || '';
                if (contentType.includes('application/json') || contentType.includes('text/json')) {
                    try {
                        responseJson = JSON.parse(responseBody);
                    } catch {
                        // Not valid JSON, keep as text
                    }
                }
            } catch (bodyError) {
                responseBody = `Error reading response body: ${bodyError instanceof Error ? bodyError.message : String(bodyError)}`;
            }
            
            return {
                success: true,
                method: method.toUpperCase(),
                url,
                status: response.status,
                status_text: response.statusText,
                ok: response.ok,
                headers: responseHeaders,
                body: responseBody,
                json: responseJson,
                size: responseBody.length,
                response_time_ms: endTime - startTime,
                redirected: response.redirected,
                final_url: response.url
            };
            
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    method: method.toUpperCase(),
                    url,
                    error: 'Request timeout',
                    timeout_ms: timeout
                };
            }
            
            return {
                success: false,
                method: method.toUpperCase(),
                url,
                error: error.message || String(error),
                error_type: error.name || 'Unknown',
                network_error: error.cause ? String(error.cause) : undefined
            };
        }
    }
};
