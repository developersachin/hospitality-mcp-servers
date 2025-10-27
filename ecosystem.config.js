module.exports = {
  apps: [
    {
      name: 'orchestrator-mcp',
      script: './src/orchestrator-mcp/server.js',
      env: {
        NODE_ENV: 'production',
        ORCHESTRATOR_PORT: 3000
      }
    },
    {
      name: 'hotel-mcp',
      script: './src/hotel-mcp/server.js',
      env: {
        NODE_ENV: 'production',
        HOTEL_MCP_PORT: 3001
      }
    },
    {
      name: 'restaurant-mcp',
      script: './src/restaurant-mcp/server.js',
      env: {
        NODE_ENV: 'production',
        RESTAURANT_MCP_PORT: 3002
      }
    },
    {
      name: 'user-mcp',
      script: './src/user-mcp/server.js',
      env: {
        NODE_ENV: 'production',
        USER_MCP_PORT: 3003
      }
    },
    {
      name: 'partner-mcp',
      script: './src/partner-mcp/server.js',
      env: {
        NODE_ENV: 'production',
        PARTNER_MCP_PORT: 3004
      }
    }
  ]
};
