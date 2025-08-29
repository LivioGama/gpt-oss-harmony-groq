#!/bin/bash

echo "🧪 Comprehensive Test - GPT-OSS Harmony Groq Proxy (Groq-Only)"
echo "=============================================================="

# Start server in background
echo "🚀 Starting server..."
bun run start &
SERVER_PID=$!
sleep 3

PASSED=0
FAILED=0

# Helper function to check test result
check_test() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  
  if [ "$actual" = "$expected" ] || [ "$expected" = "any" ]; then
    echo "✅ PASS: $test_name"
    ((PASSED++))
  else
    echo "❌ FAIL: $test_name (expected: $expected, got: $actual)"
    ((FAILED++))
  fi
}

echo ""
echo "🏥 INFRASTRUCTURE TESTS"
echo "======================="

# Test 1: Health Check
echo "Test 1: Health Check"
HEALTH=$(curl -s http://localhost:3307/health | jq -r '.status // "error"')
check_test "Health endpoint" "healthy" "$HEALTH"

# Test 2: Models Endpoint
echo "Test 2: Models Endpoint"
MODELS=$(curl -s http://localhost:3307/v1/models | jq '.data | length // 0')
if [ "$MODELS" -gt 0 ]; then
  check_test "Models endpoint" "working" "working"
else
  check_test "Models endpoint" "working" "failed"
fi

echo ""
echo "🤖 GROQ MODEL TESTS"
echo "==================="

# Test 3: GPT-OSS 20B with harmony formatting
echo "Test 3: GPT-OSS 20B with Harmony"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Say hello"}]}')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ] && [ -n "$CONTENT" ]; then
  check_test "GPT-OSS 20B chat" "working" "working"
else
  check_test "GPT-OSS 20B chat" "working" "failed"
fi

# Test 4: Llama 3 8B
echo "Test 4: Llama 3 8B Chat"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3-8b-8192", "messages": [{"role": "user", "content": "Say hello"}]}')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ] && [ -n "$CONTENT" ]; then
  check_test "Llama 3 8B chat" "working" "working"
else
  check_test "Llama 3 8B chat" "working" "failed"
fi

# Test 5: Gemma Model
echo "Test 5: Gemma Model"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gemma2-9b-it", "messages": [{"role": "user", "content": "Say hello"}]}')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ] && [ -n "$CONTENT" ]; then
  check_test "Gemma model" "working" "working"
else
  check_test "Gemma model" "working" "failed"
fi

echo ""
echo "🔧 TOOL CALLING TESTS"
echo "====================="

# Test 6: GPT-OSS with Tools
echo "Test 6: GPT-OSS Model with Tools"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role": "user", "content": "What is the weather in Paris?"}],
    "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get weather", "parameters": {"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]}}}]
  }')
TOOL_NAME=$(echo "$RESPONSE" | jq -r '.choices[0].message.tool_calls[0].function.name // "none"')
if [ "$TOOL_NAME" = "get_weather" ]; then
  check_test "GPT-OSS tool calling" "working" "working"
else
  check_test "GPT-OSS tool calling" "working" "failed"
fi

# Test 7: Regular Groq Model with Tools
echo "Test 7: Regular Groq Model with Tools"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3-8b-8192",
    "messages": [{"role": "user", "content": "What time is it?"}],
    "tools": [{"type": "function", "function": {"name": "get_time", "description": "Get current time"}}]
  }')
FINISH_REASON=$(echo "$RESPONSE" | jq -r '.choices[0].finish_reason // "none"')
if [ "$FINISH_REASON" = "tool_calls" ] || [ "$FINISH_REASON" = "stop" ]; then
  check_test "Regular Groq tool calling" "working" "working"
else
  check_test "Regular Groq tool calling" "working" "failed"
fi

echo ""
echo "📡 STREAMING TESTS"
echo "=================="

# Test 8: Streaming
echo "Test 8: Streaming Response"
STREAM_RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Count to 3"}], "stream": true}' \
  | head -n 5 | grep "data:" | wc -l)
if [ "$STREAM_RESPONSE" -gt 0 ]; then
  check_test "Streaming responses" "working" "working"
else
  check_test "Streaming responses" "working" "failed"
fi

echo ""
echo "🎨 CLINE/CURSOR COMPATIBILITY TESTS"
echo "==================================="

# Test 9: Cline User-Agent Detection
echo "Test 9: Cline User-Agent Detection"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "User-Agent: Cline/1.0.0" \
  -d '{"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Hello"}]}')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ] && [ -n "$CONTENT" ]; then
  check_test "Cline compatibility" "working" "working"
else
  check_test "Cline compatibility" "working" "failed"
fi

# Test 10: Tool Choice None with Tools
echo "Test 10: Tool Choice None with Tools"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "User-Agent: Cline/1.0.0" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role": "user", "content": "Just say hello"}],
    "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get weather"}}],
    "tool_choice": "none"
  }')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
TOOL_CALLS=$(echo "$RESPONSE" | jq '.choices[0].message.tool_calls // [] | length')
if [ "$CONTENT" != "error" ] && [ "$TOOL_CALLS" = "0" ]; then
  check_test "Tool choice none compatibility" "working" "working"
else
  check_test "Tool choice none compatibility" "working" "failed"
fi

echo ""
echo "⚙️ PARAMETER TESTS"
echo "=================="

# Test 11: Temperature Parameter
echo "Test 11: Temperature Parameter"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Hello"}], "temperature": 0.1}')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
if [ "$CONTENT" != "error" ] && [ "$CONTENT" != "null" ] && [ -n "$CONTENT" ]; then
  check_test "Temperature parameter" "working" "working"
else
  check_test "Temperature parameter" "working" "failed"
fi

# Test 12: Max Tokens Parameter
echo "Test 12: Max Tokens Parameter"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}')
STATUS_CODE=$(echo "$RESPONSE" | jq -r '.choices[0].finish_reason // "error"')
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // "error"')
# Max tokens test passes if we get a valid response (content can be empty due to token limit)
if [ "$STATUS_CODE" != "error" ] && [ "$STATUS_CODE" != "null" ] && [ "$CONTENT" != "error" ]; then
  check_test "Max tokens parameter" "working" "working"
else
  check_test "Max tokens parameter" "working" "failed"
fi

echo ""
echo "❌ ERROR HANDLING TESTS"
echo "======================="

# Test 13: Invalid Model
echo "Test 13: Invalid Model"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "invalid-model-name", "messages": [{"role": "user", "content": "Hello"}]}')
ERROR=$(echo "$RESPONSE" | jq -r '.error.message // "none"')
if [ "$ERROR" != "none" ]; then
  check_test "Invalid model error" "working" "working"
else
  check_test "Invalid model error" "working" "failed"
fi

# Test 14: Empty Messages
echo "Test 14: Empty Messages"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-20b", "messages": []}')
ERROR=$(echo "$RESPONSE" | jq -r '.error.message // "none"')
if [ "$ERROR" != "none" ]; then
  check_test "Empty messages error" "working" "working"
else
  check_test "Empty messages error" "working" "failed"
fi

# Test 15: Missing Model
echo "Test 15: Missing Model"
RESPONSE=$(curl -s -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}')
ERROR=$(echo "$RESPONSE" | jq -r '.error.message // "none"')
if [ "$ERROR" != "none" ]; then
  check_test "Missing model error" "working" "working"
else
  check_test "Missing model error" "working" "failed"
fi

echo ""
echo "📊 LOGGING TESTS"
echo "================"
echo "Checking log file exists and has content..."
if [ -f "gpt-oss-harmony-groq.log" ] && [ -s "gpt-oss-harmony-groq.log" ]; then
  LOG_SIZE=$(wc -c < gpt-oss-harmony-groq.log)
  echo "✅ Log file exists and has content ($LOG_SIZE bytes)"
  ((PASSED++))
else
  echo "❌ Log file missing or empty"
  ((FAILED++))
fi

# Cleanup
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "📈 FINAL RESULTS"
echo "================"
TOTAL=$((PASSED + FAILED))
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
  echo "🎉 All tests passed!"
  exit 0
else
  echo "⚠️ Some tests failed"
  exit 1
fi