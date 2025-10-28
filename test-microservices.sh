#!/bin/bash

API_URL="https://ppve41wv3f.execute-api.us-east-1.amazonaws.com"

echo "=========================================="
echo "COMPLETE MCP MICROSERVICES TEST"
echo "=========================================="
echo ""

# Test 1: Health Checks
echo "1️⃣ Health Checks:"
echo "Hotel:" && curl -s $API_URL/hotel/health | jq '.'
echo "Restaurant:" && curl -s $API_URL/restaurant/health | jq '.'
echo "Orchestrator:" && curl -s $API_URL/health | jq '.'
echo ""

# Test 2: Create Session
echo "2️⃣ Creating Session:"
SESSION_RESPONSE=$(curl -s -X POST $API_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"session_create","arguments":{"client_id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","domain":"dubaihotel.com"}}}')
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.result.content[0].text | fromjson | .session_id')
echo "Session ID: $SESSION_ID"
echo ""

# Test 3: Search Hotels
echo "3️⃣ Searching Hotels:"
curl -s -X POST $API_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"search_hotels","arguments":{"location":"Dubai"}}}' | jq '.result.content[0].text | fromjson | .hotels[0:2]'
echo ""

# Test 4: Search Restaurants
echo "4️⃣ Searching Restaurants:"
curl -s -X POST $API_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"search_restaurants","arguments":{"location":"London"}}}' | jq '.result.content[0].text | fromjson | .restaurants[0:2]'
echo ""

echo "=========================================="
echo "✅ ALL TESTS COMPLETE!"
echo "=========================================="
