# Complete MCP Servers Implementation

All mock data has been generated (50 hotels + 50 restaurants). 

Now follow these steps to create all MCP servers:

## Step 1: Run the MCP Server Generator

```bash
node scripts/generate-mcp-servers.js
```

This will create all 5 MCP servers with complete implementations.

## Step 2: Install Dependencies  

```bash
npm install
```

## Step 3: Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

## Step 4: Start All Servers

```bash
npm run start:all
```

## Testing

```bash
# Test Hotel MCP
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/list"
  }'
```

All servers will be running on:
- Orchestrator: http://localhost:3000
- Hotel MCP: http://localhost:3001
- Restaurant MCP: http://localhost:3002
- User MCP: http://localhost:3003
- Partner MCP: http://localhost:3004

