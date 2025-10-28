const fs = require('fs');
const path = require('path');

console.log('🚀 Creating Lambda handlers...\n');

const lambdaDir = path.join(__dirname, '../lambda-handlers');
if (!fs.existsSync(lambdaDir)) {
  fs.mkdirSync(lambdaDir, { recursive: true });
}

// Hotel MCP Handler
const hotelHandler = `const express = require('express');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

let hotelsData = {};
let hotelsByCity = {};
let hotelsById = {};
let availabilityState = {};

function loadHotelData() {
  const cities = ['dubai', 'london', 'newyork', 'singapore', 'newdelhi'];
  cities.forEach(city => {
    const filePath = path.join(__dirname, \`../mock-data/hotels/\${city}-hotels.json\`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    hotelsData[city] = data;
    hotelsByCity[data.city] = data.hotels;
    data.hotels.forEach(hotel => {
      hotelsById[hotel.property_id] = hotel;
      availabilityState[hotel.property_id] = JSON.parse(JSON.stringify(hotel.availability_calendar));
    });
  });
  console.log(\`✅ Loaded \${Object.keys(hotelsById).length} hotels\`);
}

loadHotelData();

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'hotel-mcp-lambda', hotels: Object.keys(hotelsById).length });
});

app.post('/mcp', (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [
        { name: 'search_hotels', description: 'Search hotels' },
        { name: 'get_hotel_details', description: 'Get hotel details' },
        { name: 'check_availability', description: 'Check availability' }
      ]}
    });
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      let result;
      if (name === 'search_hotels') {
        const cityHotels = hotelsByCity[args.location] || [];
        result = { hotels: cityHotels.slice(0, 10).map(h => ({
          property_id: h.property_id,
          name: h.name,
          star_rating: h.star_rating,
          rating: h.rating,
          amenities: h.amenities,
          room_types: h.room_types
        })), count: cityHotels.length };
      } else if (name === 'get_hotel_details') {
        result = hotelsById[args.hotel_id] || null;
      } else {
        result = { available: true };
      }
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: { code: -32000, message: error.message }
      });
    }
  }
});

module.exports.handler = serverless(app);
`;

// Restaurant MCP Handler
const restaurantHandler = `const express = require('express');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

let restaurantsByCity = {};
let restaurantsById = {};

function loadRestaurantData() {
  const cities = ['dubai', 'london', 'newyork', 'singapore', 'newdelhi'];
  cities.forEach(city => {
    const filePath = path.join(__dirname, \`../mock-data/restaurants/\${city}-restaurants.json\`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    restaurantsByCity[data.city] = data.restaurants;
    data.restaurants.forEach(r => { restaurantsById[r.property_id] = r; });
  });
  console.log(\`✅ Loaded \${Object.keys(restaurantsById).length} restaurants\`);
}

loadRestaurantData();

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'restaurant-mcp-lambda' });
});

app.post('/mcp', (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [{ name: 'search_restaurants', description: 'Search restaurants' }] }
    });
  }
  if (method === 'tools/call') {
    try {
      const cityRestaurants = restaurantsByCity[params.arguments.location] || [];
      const result = { restaurants: cityRestaurants.slice(0, 10), count: cityRestaurants.length };
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: { code: -32000, message: error.message }
      });
    }
  }
});

module.exports.handler = serverless(app);
`;

// User MCP Handler
const userHandler = `const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-mcp-lambda' });
});

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [
        { name: 'create_user', description: 'Create user' },
        { name: 'get_user_by_email', description: 'Get user' }
      ]}
    });
  }
  if (method === 'tools/call') {
    try {
      const { name, arguments: args } = params;
      let result;
      if (name === 'create_user') {
        const { data } = await supabase.from('users').insert(args).select().single();
        result = data;
      } else {
        const { data } = await supabase.from('users').select('*').eq('email', args.email).single();
        result = data;
      }
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: { code: -32000, message: error.message }
      });
    }
  }
});

module.exports.handler = serverless(app);
`;

// Partner MCP Handler
const partnerHandler = `const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'partner-mcp-lambda' });
});

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [{ name: 'get_partner_properties', description: 'Get partners' }] }
    });
  }
  if (method === 'tools/call') {
    try {
      const { data } = await supabase
        .from('partner_relationships')
        .select('*')
        .eq('client_id', params.arguments.client_id)
        .eq('is_active', true);
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { content: [{ type: 'text', text: JSON.stringify({ partners: data || [] }) }] }
      });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: { code: -32000, message: error.message }
      });
    }
  }
});

module.exports.handler = serverless(app);
`;

// Orchestrator MCP Handler
const orchestratorHandler = `const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const childMCPs = {
  hotel: process.env.HOTEL_MCP_URL,
  restaurant: process.env.RESTAURANT_MCP_URL,
  user: process.env.USER_MCP_URL,
  partner: process.env.PARTNER_MCP_URL
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'orchestrator-mcp-lambda' });
});

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [
        { name: 'session_create', description: 'Create session' },
        { name: 'search_hotels', description: 'Search hotels' },
        { name: 'search_restaurants', description: 'Search restaurants' },
        { name: 'cart_add_item', description: 'Add to cart' },
        { name: 'cart_get', description: 'Get cart' }
      ]}
    });
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      let result;
      switch (name) {
        case 'session_create': result = await createSession(args); break;
        case 'search_hotels': result = await callChildMCP('hotel', 'search_hotels', args); break;
        case 'search_restaurants': result = await callChildMCP('restaurant', 'search_restaurants', args); break;
        case 'cart_add_item': result = await addToCart(args); break;
        case 'cart_get': result = await getCart(args); break;
        default: throw new Error(\`Unknown tool: \${name}\`);
      }
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      });
    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: { code: -32000, message: error.message }
      });
    }
  }
});

async function callChildMCP(mcpName, tool, args) {
  const response = await axios.post(childMCPs[mcpName], {
    jsonrpc: '2.0',
    id: '1',
    method: 'tools/call',
    params: { name: tool, arguments: args }
  });
  return JSON.parse(response.data.result.content[0].text);
}

async function createSession({ client_id, domain }) {
  const { data: client } = await supabase.from('clients').select('*').eq('client_id', client_id).single();
  if (!client) throw new Error('Client not found');
  if (!client.allowed_domains.includes(domain)) throw new Error('Domain not authorized');
  const { data: session } = await supabase.from('sessions').insert({
    client_id,
    session_type: 'anonymous',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }).select().single();
  return { session_id: session.session_id, client_config: client.branding_config };
}

async function addToCart({ session_id, item }) {
  const { data: existingCarts } = await supabase.from('carts').select('*').eq('session_id', session_id).eq('status', 'active');
  let cart = existingCarts && existingCarts.length > 0 ? existingCarts[0] : null;
  if (!cart) {
    const { data: newCart } = await supabase.from('carts').insert({
      session_id,
      client_id: item.client_id,
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }).select().single();
    cart = newCart;
  }
  await supabase.from('cart_items').insert({
    cart_id: cart.cart_id,
    property_id: item.property_id,
    property_type: item.property_type,
    is_partner: item.is_partner,
    service_details: item.service_details,
    unit_price: item.unit_price,
    quantity: item.quantity || 1,
    total_price: item.total_price,
    currency: item.currency || 'USD'
  });
  return { success: true, cart_id: cart.cart_id };
}

async function getCart({ session_id }) {
  const { data: carts } = await supabase.from('carts').select('*, cart_items (*)').eq('session_id', session_id).eq('status', 'active');
  return carts && carts.length > 0 ? carts[0] : { cart_items: [] };
}

module.exports.handler = serverless(app);
`;

// Write all files
fs.writeFileSync(path.join(lambdaDir, 'hotel-mcp-handler.js'), hotelHandler);
fs.writeFileSync(path.join(lambdaDir, 'restaurant-mcp-handler.js'), restaurantHandler);
fs.writeFileSync(path.join(lambdaDir, 'user-mcp-handler.js'), userHandler);
fs.writeFileSync(path.join(lambdaDir, 'partner-mcp-handler.js'), partnerHandler);
fs.writeFileSync(path.join(lambdaDir, 'orchestrator-mcp-handler.js'), orchestratorHandler);

console.log('✅ Created hotel-mcp-handler.js');
console.log('✅ Created restaurant-mcp-handler.js');
console.log('✅ Created user-mcp-handler.js');
console.log('✅ Created partner-mcp-handler.js');
console.log('✅ Created orchestrator-mcp-handler.js');
console.log('\n🎉 All Lambda handlers created!');
