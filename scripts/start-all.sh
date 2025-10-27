#!/bin/bash

echo "🚀 Starting all MCP servers..."

# Start each server in background
cd src/orchestrator-mcp && node server.js &
echo "Started Orchestrator MCP (Port 3000)"

cd ../hotel-mcp && node server.js &
echo "Started Hotel MCP (Port 3001)"

cd ../restaurant-mcp && node server.js &
echo "Started Restaurant MCP (Port 3002)"

cd ../user-mcp && node server.js &
echo "Started User MCP (Port 3003)"

cd ../partner-mcp && node server.js &
echo "Started Partner MCP (Port 3004)"

echo ""
echo "✅ All servers started!"
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
wait
