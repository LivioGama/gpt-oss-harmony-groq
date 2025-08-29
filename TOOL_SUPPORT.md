# GPT-OSS Tool Support

This document describes the comprehensive tool support system integrated into the GPT-OSS Harmony Groq proxy server.

## Overview

The enhanced server now includes automatic tool execution capabilities, allowing GPT-OSS models to interact with external systems and perform real-world tasks. The tool system is compatible with OpenAI's tool calling API and includes built-in tools for common operations.

## Features

- **Auto Tool Execution**: Automatically executes tool calls and continues conversations
- **Built-in Tools**: 5 pre-configured tools for common tasks
- **Security**: Safe execution with timeouts and sandboxing
- **OpenAI Compatible**: Uses standard OpenAI tool calling format
- **Configurable**: Runtime configuration of tool behavior
- **Extensible**: Easy to add custom tools

## Built-in Tools

### 1. Web Search (`web_search`)
Search the web for current information on any topic.

**Parameters:**
- `query` (string, required): The search query
- `num_results` (number, optional): Number of results (1-10, default: 5)

**Example:**
```bash
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "Search for the latest AI news"}
    ]
  }'
```

### 2. Code Execution (`execute_code`)
Execute code in JavaScript, Python, or Shell environments.

**Parameters:**
- `language` (string, required): "javascript", "python", "shell", or "bash"
- `code` (string, required): The code to execute
- `timeout` (number, optional): Timeout in ms (1000-30000, default: 10000)

**Example:**
```bash
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "Execute this Python code: print([x**2 for x in range(5)])"}
    ]
  }'
```

### 3. File Operations (`file_operations`)
Perform safe file system operations within the current directory.

**Parameters:**
- `operation` (string, required): "read", "write", "list", or "exists"
- `path` (string, required): File or directory path (relative to working directory)
- `content` (string, optional): Content to write (required for write operation)
- `encoding` (string, optional): "utf8" or "base64" (default: utf8)

**Example:**
```bash
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "List all files in the current directory"}
    ]
  }'
```

### 4. Weather Information (`get_weather`)
Get current weather information for any location using free weather APIs.

**Parameters:**
- `location` (string, required): City and state/country (e.g., "San Francisco, CA")
- `unit` (string, optional): "celsius" or "fahrenheit" (default: celsius)

**Example:**
```bash
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "What'\''s the weather like in Tokyo?"}
    ]
  }'
```

### 5. Calculator (`calculator`)
Perform mathematical calculations including basic arithmetic, trigonometry, and advanced functions.

**Parameters:**
- `expression` (string, required): Mathematical expression to evaluate
- `precision` (number, optional): Decimal places (0-15, default: 10)

**Example:**
```bash
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "Calculate sin(pi/2) + sqrt(16)"}
    ]
  }'
```

## API Endpoints

### Tool Management

#### `GET /v1/tools`
List all available tools with their schemas.

```bash
curl http://localhost:3307/v1/tools
```

#### `GET /v1/tools/stats`
Get tool execution statistics and configuration.

```bash
curl http://localhost:3307/v1/tools/stats
```

#### `POST /v1/tools/config`
Configure tool execution behavior.

```bash
curl -X POST http://localhost:3307/v1/tools/config \
  -H "Content-Type: application/json" \
  -d '{
    "autoExecution": true,
    "maxIterations": 5
  }'
```

### Chat Completions with Tools

#### `POST /v1/chat/completions`
Standard OpenAI-compatible chat completions with automatic tool execution.

**Request Body:**
```json
{
  "model": "openai/gpt-oss-20b",
  "messages": [
    {"role": "user", "content": "Your message here"}
  ],
  "tools": [...],           // Optional: custom tools
  "tool_choice": "auto",    // Optional: "auto", "none", or specific tool
  "stream": false           // Optional: streaming support
}
```

## Configuration

### Environment Variables

- `GROQ_API_KEY`: Your Groq API key (required)
- `PORT`: Server port (default: 3307)

### Runtime Configuration

Use the `/v1/tools/config` endpoint to adjust:

- `autoExecution`: Enable/disable automatic tool execution (default: true)
- `maxIterations`: Maximum tool execution iterations per request (default: 5)

## Security Features

1. **Sandboxed Execution**: Code execution is isolated and time-limited
2. **File System Restrictions**: File operations are restricted to the current working directory
3. **Timeout Protection**: All tool executions have configurable timeouts
4. **Concurrent Limits**: Maximum concurrent tool executions are limited
5. **Input Validation**: All tool parameters are validated before execution

## Integration Examples

### With OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3307/v1",
    api_key="not-needed"  # Groq API key is configured server-side
)

response = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[
        {"role": "user", "content": "Calculate 15 * 8 and then get weather for Tokyo"}
    ]
)

print(response.choices[0].message.content)
```

### With OpenAI SDK (Node.js)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3307/v1',
  apiKey: 'not-needed'
});

const response = await openai.chat.completions.create({
  model: 'openai/gpt-oss-20b',
  messages: [
    { role: 'user', content: 'Execute this code: console.log("Hello, tools!")' }
  ]
});

console.log(response.choices[0].message.content);
```

## Tool Execution Flow

1. **Request Processing**: User sends chat completion request
2. **Tool Detection**: System analyzes if tools are needed
3. **Auto Enhancement**: Built-in tools are automatically added to the request
4. **Model Response**: GPT-OSS generates response with tool calls
5. **Tool Execution**: System executes requested tools automatically
6. **Result Integration**: Tool results are fed back to the model
7. **Final Response**: Model generates final response with tool results
8. **Iteration**: Process repeats if more tools are needed (up to max iterations)

## Error Handling

- **Tool Not Found**: Returns error message with available tools
- **Invalid Parameters**: Validates parameters and returns specific error
- **Execution Timeout**: Gracefully handles timeouts with partial results
- **Permission Denied**: Safe handling of file system access errors
- **Network Errors**: Robust error handling for web search and weather APIs

## Performance Considerations

- **Concurrent Execution**: Multiple tools can execute simultaneously
- **Caching**: Results may be cached for repeated operations
- **Timeouts**: Configurable timeouts prevent hanging requests
- **Resource Limits**: Memory and CPU usage are monitored and limited

## Testing

Run the comprehensive test suite:

```bash
# Basic tool functionality
bun run tests/test-tool-basic.js

# Full integration tests
./tests/test-tools.sh

# Manual testing
curl http://localhost:3307/v1/tools
```

## Extending the System

### Adding Custom Tools

1. Create a new tool file in `src/tools/`
2. Implement the `ToolFunction` interface
3. Register the tool in the registry
4. Update the index exports

Example custom tool:

```typescript
import type { ToolFunction } from './tool-registry';

export const myCustomTool: ToolFunction = {
    name: 'my_custom_tool',
    description: 'Description of what this tool does',
    parameters: {
        type: 'object',
        properties: {
            param1: {
                type: 'string',
                description: 'Parameter description'
            }
        },
        required: ['param1']
    },
    async execute(args: { param1: string }): Promise<any> {
        // Implementation here
        return { result: 'success' };
    }
};
```

## Troubleshooting

### Common Issues

1. **Tools not executing**: Check `autoExecution` setting in `/v1/tools/stats`
2. **Permission errors**: Ensure file paths are within working directory
3. **Timeout errors**: Increase timeout values or optimize tool logic
4. **API errors**: Check Groq API key and network connectivity

### Debug Mode

Enable detailed logging by setting environment variables:
```bash
DEBUG=1 bun run start
```

### Health Check

Verify system health:
```bash
curl http://localhost:3307/health
```

## Compatibility

- **OpenAI API**: Fully compatible with OpenAI tool calling format
- **Groq Models**: Optimized for gpt-oss-20b and gpt-oss-120b
- **Streaming**: Supports streaming responses (tools execute after stream completion)
- **Cline/Cursor**: Enhanced compatibility with coding assistants

## License

This tool system is part of the GPT-OSS Harmony Groq proxy and follows the same license terms.
