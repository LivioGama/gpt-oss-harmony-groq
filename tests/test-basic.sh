#!/bin/bash

echo "🧪 Testing GPT-OSS Harmony Groq Proxy (Groq-Only)"
echo "=================================================="

PORT=3307
BASE_URL="http://localhost:$PORT"

# Start server in background
echo "🚀 Starting server..."
bun run start &
SERVER_PID=$!
sleep 3

echo ""
echo "1. Testing health endpoint..."
HEALTH=$(curl -s "$BASE_URL/health" | jq -r '.status // "error"')
if [ "$HEALTH" = "healthy" ]; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed: $HEALTH"
fi

echo ""
echo "2. Testing models endpoint..."
MODELS=$(curl -s "$BASE_URL/v1/models" | jq '.data | length // 0')
if [ "$MODELS" -gt 0 ]; then
  echo "✅ Models endpoint working ($MODELS models available)"
  curl -s "$BASE_URL/v1/models" | jq '.data[0:3] | .[].id'
else
  echo "❌ Models endpoint failed"
fi

echo ""
echo "3. Testing openai/gpt-oss-20b (Groq with harmony)..."
RESPONSE=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role": "user", "content": "Say hello briefly"}],
    "max_tokens": 50
  }')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ]; then
  echo "✅ GPT-OSS model working: $CONTENT"
else
  echo "❌ GPT-OSS model failed"
fi

echo ""
echo "4. Testing regular Groq model..."
RESPONSE=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3-8b-8192",
    "messages": [{"role": "user", "content": "Say hello briefly"}],
    "max_tokens": 50
  }')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ]; then
  echo "✅ Regular Groq model working: $CONTENT"
else
  echo "❌ Regular Groq model failed"
fi

echo ""
echo "5. Testing harmony format with system message..."
RESPONSE=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What are you?"}
    ],
    "max_tokens": 100
  }')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ]; then
  echo "✅ System message with harmony format working"
else
  echo "❌ System message with harmony format failed"
fi

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "✅ Basic tests completed!"
