#!/bin/bash

set -e

BASE_URL="http://localhost:3307"
MODEL="openai/gpt-oss-20b"

echo "🧪 Testing GPT-OSS Tool Support"
echo "================================"

echo "📋 1. Testing available tools endpoint..."
curl -s "$BASE_URL/v1/tools" | jq '.'

echo -e "\n📊 2. Testing tool execution stats..."
curl -s "$BASE_URL/v1/tools/stats" | jq '.'

echo -e "\n🧮 3. Testing calculator tool..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Calculate the square root of 144 plus 5 times 3\"}
    ]
  }" | jq '.choices[0].message.content'

echo -e "\n🌤️  4. Testing weather tool..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"What's the current weather in San Francisco?\"}
    ]
  }" | jq '.choices[0].message.content'

echo -e "\n💻 5. Testing code execution tool..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Write and execute a JavaScript function that returns the fibonacci sequence up to 10 numbers\"}
    ]
  }" | jq '.choices[0].message.content'

echo -e "\n📁 6. Testing file operations tool..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"List the files in the current directory\"}
    ]
  }" | jq '.choices[0].message.content'

echo -e "\n🔍 7. Testing web search tool..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Search for the latest news about artificial intelligence\"}
    ]
  }" | jq '.choices[0].message.content'

echo -e "\n⚙️  8. Testing tool configuration..."
curl -s -X POST "$BASE_URL/v1/tools/config" \
  -H "Content-Type: application/json" \
  -d "{
    \"autoExecution\": true,
    \"maxIterations\": 3
  }" | jq '.'

echo -e "\n📊 9. Testing updated stats..."
curl -s "$BASE_URL/v1/tools/stats" | jq '.'

echo -e "\n🔄 10. Testing multiple tool calls in one request..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Calculate 15 * 8, then get the weather for that result as a temperature in Celsius (if it makes sense), and also search for information about the number you calculated\"}
    ]
  }" | jq '.choices[0].message.content'

echo -e "\n✅ Tool testing completed!"