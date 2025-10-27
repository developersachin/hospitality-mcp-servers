const axios = require('axios');

const servers = [
  { name: 'Hotel MCP', port: 3001 },
  { name: 'Restaurant MCP', port: 3002 },
  { name: 'User MCP', port: 3003 },
  { name: 'Partner MCP', port: 3004 },
  { name: 'Orchestrator MCP', port: 3000 }
];

async function testServer(server) {
  try {
    const response = await axios.get(`http://localhost:${server.port}/health`);
    console.log(`✅ ${server.name}: ${response.data.status}`);
    return true;
  } catch (error) {
    console.log(`❌ ${server.name}: Not responding`);
    return false;
  }
}

async function testAll() {
  console.log('🧪 Testing all MCP servers...\n');
  
  for (const server of servers) {
    await testServer(server);
  }
  
  console.log('\nTest complete!');
}

testAll();
