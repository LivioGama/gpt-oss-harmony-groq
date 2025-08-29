#!/bin/bash

echo "🔧 Testing Tool Calls with GPT-OSS Harmony Groq Proxy (Groq-Only)"
echo "=================================================================="

# Start server in background
echo "🚀 Starting server..."
bun run start &
SERVER_PID=$!
sleep 3

echo ""
echo "1. Testing GPT-OSS model with single tool..."
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "What is the weather like in Paris?"}
    ],
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
TOOL_ARGS=$(echo "$RESPONSE" | jq -r '.choices[0].message.tool_calls[0].function.arguments // "{}"')
FINISH_REASON=$(echo "$RESPONSE" | jq -r '.choices[0].finish_reason // "unknown"')

echo "✅ Tool called: $TOOL_NAME"
echo "✅ Arguments: $TOOL_ARGS"
echo "✅ Finish reason: $FINISH_REASON"

echo ""
echo "2. Testing GPT-OSS model with multiple tools..."
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "I need to check the weather in Tokyo and also send an email"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get weather information",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string"}
            },
            "required": ["location"]
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "send_email",
          "description": "Send an email",
          "parameters": {
            "type": "object",
            "properties": {
              "to": {"type": "string"},
              "subject": {"type": "string"},
              "body": {"type": "string"}
            },
            "required": ["to", "subject", "body"]
          }
        }
      }
    ]
  }')

TOOL_COUNT=$(echo "$RESPONSE" | jq '.choices[0].message.tool_calls | length // 0')
echo "✅ Number of tools called: $TOOL_COUNT"

if [ "$TOOL_COUNT" -gt 0 ]; then
  echo "$RESPONSE" | jq '.choices[0].message.tool_calls[].function.name'
fi

echo ""
echo "3. Testing Cline/Cursor compatibility (tool_choice: none with tools)..."
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "User-Agent: Cline/1.0.0" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "user", "content": "Just say hello, do not use any tools"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get weather information",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string"}
            }
          }
        }
      }
    ],
    "tool_choice": "none"
  }')

CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
TOOL_CALLS=$(echo "$RESPONSE" | jq '.choices[0].message.tool_calls // []')

echo "✅ Response: $CONTENT"
echo "✅ Tool calls (should be empty): $TOOL_CALLS"

echo ""
echo "4. Testing regular Groq model with tools..."
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3-8b-8192",
    "messages": [
      {"role": "user", "content": "What is the time?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_time",
          "description": "Get current time",
          "parameters": {
            "type": "object",
            "properties": {}
          }
        }
      }
    ]
  }')

TOOL_NAME=$(echo "$RESPONSE" | jq -r '.choices[0].message.tool_calls[0].function.name // "No tool call"')
echo "✅ Regular Groq model tool call: $TOOL_NAME"

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "✅ Tool call tests completed!"