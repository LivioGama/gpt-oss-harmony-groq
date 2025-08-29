#!/bin/bash

echo "🔬 Simple Test - GPT-OSS Harmony Groq Proxy (Groq-Only)"
echo "========================================================"

# Start server in background
echo "🚀 Starting server..."
bun run start &
SERVER_PID=$!
sleep 3

echo "1. Health Check:"
HEALTH=$(curl -s http://localhost:3307/health | jq -r '.status // "error"')
echo "Status: $HEALTH"

echo ""
echo "2. Basic GPT-OSS Chat Test:"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role": "user", "content": "Hello! Just say hello back briefly."}]
  }')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
echo "Response: $CONTENT"

echo ""
echo "3. GPT-OSS Tool Call Test:"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role": "user", "content": "What is the weather like in New York?"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get current weather information for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string", "description": "The city name"}
            },
            "required": ["location"]
          }
        }
      }
    ]
  }')
TOOL_NAME=$(echo "$RESPONSE" | jq -r '.choices[0].message.tool_calls[0].function.name // "No tool call"')
echo "Tool called: $TOOL_NAME"

echo ""
echo "4. Regular Groq Model Test:"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3-8b-8192",
    "messages": [{"role": "user", "content": "Say hi briefly"}]
  }')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
echo "Response: $CONTENT"

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "✅ Tests completed!"