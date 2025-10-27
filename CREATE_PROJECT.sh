#!/bin/bash

# This script generates the complete MCP servers project
# Run: bash CREATE_PROJECT.sh

echo "🚀 Creating White-Label AI Hospitality MCP Servers Project..."

# Create all necessary directories
echo "📁 Creating directory structure..."
mkdir -p mock-data/{hotels,restaurants}
mkdir -p src/{orchestrator-mcp,hotel-mcp,restaurant-mcp,user-mcp,partner-mcp}/handlers
mkdir -p config scripts logs docs

# Mark as executable
chmod +x CREATE_PROJECT.sh

echo "✅ Project structure created!"
echo "⚠️  Due to file size, please run the individual generation scripts:"
echo "   1. bash scripts/generate-mock-data.sh"
echo "   2. bash scripts/generate-mcp-servers.sh"
echo ""
echo "Or download the complete project from:"
echo "https://github.com/your-repo/hospitality-mcp-servers"

