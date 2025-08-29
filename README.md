# GPT-OSS Harmony Groq Proxy

A sophisticated proxy server that integrates Transformers chat templates with Groq API for gpt-oss-20b, featuring
harmony format support and OpenAI-compatible endpoints.

## ✨ Features

- **🤖 Transformers Chat Templates**: Built-in support for structured message formatting
- **🎯 Harmony Format**: Specialized formatting for gpt-oss models with tool calling
- **⚡ Groq Integration**: High-speed inference through Groq API
- **🛠️ Tool Calling**: Advanced function calling with proper formatting
- **🔧 Cline/Cursor Compatible**: Enhanced compatibility for popular AI coding assistants
- **📡 Streaming Support**: Real-time streaming responses
- **🌐 OpenAI Compatible**: Drop-in replacement for OpenAI API endpoints

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Harmony Proxy  │───▶│   Groq API      │
│  (Cursor/IDE)   │    │  (Transformers) │    │  (gpt-oss-20b)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │ Chat Templates  │
                       │ & Tool Parsing  │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Bun** runtime installed
- **Groq API key** (get one from [console.groq.com](https://console.groq.com))

### Installation

1. **Clone and setup**:

```bash
cd /Users/livio/Documents/gpt-oss-harmony-groq
bun install
```

2. **Configure environment**:

```bash
# Edit .env file
echo "GROQ_API_KEY=gsk_your_actual_key_here" > .env
echo "PORT=3307" >> .env
```

3. **Start the server**:

```bash
bun run dev
```

The server will start on `http://localhost:3307`

## 📡 API Endpoints

### Chat Completions

```http
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "gpt-oss-20b",
  "messages": [
    {
      "role": "user", 
      "content": "Hello!"
    }
  ],
  "tools": [...],
  "stream": false
}
```

### Available Models

```http
GET /v1/models
```

### Health Check

```http
GET /health
```

## 🔧 Chat Template Format

The proxy uses a specialized harmony format for gpt-oss models:

```
<|system|>
You are a helpful AI assistant that can use tools when needed.
<|end|>

<|system|>
Available tools:
- get_weather: Get current weather information
  Parameters: {"location": "string", "unit": "string"}

When using tools, format your calls as: <|tool_call|>function_name({"param": "value"})<|end_tool_call|>
<|end|>

<|user|>
What's the weather in San Francisco?
<|end|>

<|assistant|>
```

## 🛠️ Tool Calling

### Example Request

```json
{
  "model": "gpt-oss-20b",
  "messages": [
    {
      "role": "user",
      "content": "What's the weather in NYC?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string"
            }
          },
          "required": [
            "location"
          ]
        }
      }
    }
  ]
}
```

### Example Response

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "I'll check the weather for you.",
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"New York, NY\"}"
            }
          }
        ]
      }
    }
  ]
}
```

## 🧪 Testing

### Run Comprehensive Tests

```bash
./test-final.sh
```

### Run Basic Tests

```bash
./test-basic.sh
```

### Run Tool Call Tests

```bash
./test-tools.sh
```

### Manual Testing

```bash
# Test health
curl http://localhost:3307/health

# Test Groq model (works immediately)
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3-8b-8192",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Test GPT-OSS model (requires Transformers server)
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-20b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Check Logs

```bash
tail -f gpt-oss-harmony-groq.log
```

## ⚙️ Configuration

### Environment Variables

| Variable       | Default       | Description         |
|----------------|---------------|---------------------|
| `GROQ_API_KEY` | *required*    | Your Groq API key   |
| `PORT`         | `3307`        | Server port         |
| `MODEL_NAME`   | `gpt-oss-20b` | Default model       |
| `MAX_TOKENS`   | `2048`        | Default max tokens  |
| `TEMPERATURE`  | `0.7`         | Default temperature |

### Model Support

#### Transformers Models (with Harmony Format)

- **gpt-oss-20b**: Routes to Transformers server with harmony chat templates
- **gpt-oss-120b**: Routes to Transformers server with harmony chat templates

#### Groq Models (Direct API)

- **llama3-8b-8192**: Meta Llama 3 8B
- **llama3-70b-8192**: Meta Llama 3 70B
- **mixtral-8x7b-32768**: Mixtral 8x7B
- **gemma-7b-it**: Google Gemma 7B
- And all other [Groq-supported models](https://console.groq.com/docs/models)

## 🔌 Integration Examples

### Cursor/VSCode

```typescript
// Configure in settings.json
{
    "openai.api.baseURL"
:
    "http://localhost:3307/v1",
        "openai.api.key"
:
    "sk-dummy-key-not-used"
}
```

### Python Client

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3307/v1",
    api_key="sk-dummy-key-not-used"
)

response = client.chat.completions.create(
    model="gpt-oss-20b",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Node.js Client

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'http://localhost:3307/v1',
    apiKey: 'sk-dummy-key-not-used'
});

const completion = await openai.chat.completions.create({
    model: 'gpt-oss-20b',
    messages: [{role: 'user', content: 'Hello!'}]
});
```

## 🎯 Cline/Cursor Compatibility

The proxy automatically detects and enhances requests from Cline, Cursor, and other coding assistants:

- **Tool Choice Handling**: Converts `tool_choice: "none"` to `"auto"` when tools are present
- **Tool List Optimization**: Limits excessive tool lists to prevent context overflow
- **Enhanced Responses**: Improves compatibility with AI coding workflows

## 📊 Performance & Scaling

### Benchmarks

- **Latency**: ~200ms for basic completions
- **Throughput**: Supports concurrent requests
- **Memory**: Low overhead with efficient streaming

### Production Deployment

```bash
# Build for production
bun run build

# Run with PM2
pm2 start dist/server.js --name gpt-oss-proxy

# Docker deployment
docker build -t gpt-oss-proxy .
docker run -p 3307:3307 -e GROQ_API_KEY=your_key gpt-oss-proxy
```

## 🔍 Troubleshooting

### Common Issues

1. **Server won't start**
   ```bash
   # Check if port is available
   lsof -ti:3307 | xargs kill -9
   ```

2. **Groq API errors**
   ```bash
   # Verify API key
   curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
   ```

3. **Tool calls not working**
    - Ensure proper JSON formatting in tool parameters
    - Check harmony format parsing in logs

### Debug Mode

```bash
# Enable verbose logging
DEBUG=1 bun run dev
```

## 🔗 Related Projects

- [Original Reference](https://cookbook.openai.com/articles/gpt-oss/run-transformers) - Transformers documentation
- [Groq Console](https://console.groq.com) - Get your API key
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference) - Compatible endpoints

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

**Built with ❤️ using Bun, TypeScript, and the power of Transformers chat templates**
