const fs = require('fs');
const path = require('path');

console.log('🚀 Generating all MCP servers...\n');

// Helper function to create directories
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// HOTEL MCP SERVER
// ============================================================================

const hotelMCPServer = `const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.HOTEL_MCP_PORT || 3001;

app.use(express.json());

// Load all hotel data into memory
let hotelsData = {};
let hotelsByCity = {};
let hotelsById = {};

function loadHotelData() {
  const cities = ['dubai', 'london', 'newyork', 'singapore', 'newdelhi'];
  
  cities.forEach(city => {
    const filePath = path.join(__dirname, \`../../mock-data/hotels/\${city}-hotels.json\`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    hotelsData[city] = data;
    hotelsByCity[data.city] = data.hotels;
    
    data.hotels.forEach(hotel => {
      hotelsById[hotel.property_id] = hotel;
    });
  });
  
  console.log(\`✅ Loaded \${Object.keys(hotelsById).length} hotels\`);
}

// In-memory availability tracking
let availabilityState = {};

function initializeAvailability() {
  Object.values(hotelsById).forEach(hotel => {
    availabilityState[hotel.property_id] = JSON.parse(JSON.stringify(hotel.availability_calendar));
  });
}

// MCP Protocol endpoint
app.post('/mcp', (req, res) => {
  const { method, params } = req.body;
  
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        tools: [
          {
            name: 'search_hotels',
            description: 'Search for hotels by location and dates',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                check_in: { type: 'string' },
                check_out: { type: 'string' },
                guests: { type: 'number' },
                client_id: { type: 'string' }
              },
              required: ['location', 'check_in', 'check_out', 'client_id']
            }
          },
          {
            name: 'get_hotel_details',
            description: 'Get detailed information about a specific hotel',
            inputSchema: {
              type: 'object',
              properties: {
                hotel_id: { type: 'string' },
                client_id: { type: 'string' }
              },
              required: ['hotel_id', 'client_id']
            }
          },
          {
            name: 'check_availability',
            description: 'Check room availability for specific dates',
            inputSchema: {
              type: 'object',
              properties: {
                hotel_id: { type: 'string' },
                room_type: { type: 'string' },
                check_in: { type: 'string' },
                check_out: { type: 'string' },
                rooms: { type: 'number' }
              },
              required: ['hotel_id', 'room_type', 'check_in', 'check_out']
            }
          },
          {
            name: 'lock_inventory',
            description: 'Create temporary hold on rooms',
            inputSchema: {
              type: 'object',
              properties: {
                hotel_id: { type: 'string' },
                room_type: { type: 'string' },
                check_in: { type: 'string' },
                check_out: { type: 'string' },
                rooms: { type: 'number' },
                session_id: { type: 'string' }
              },
              required: ['hotel_id', 'room_type', 'check_in', 'check_out', 'rooms', 'session_id']
            }
          },
          {
            name: 'confirm_booking',
            description: 'Confirm booking and update availability',
            inputSchema: {
              type: 'object',
              properties: {
                hotel_id: { type: 'string' },
                room_type: { type: 'string' },
                check_in: { type: 'string' },
                check_out: { type: 'string' },
                rooms: { type: 'number' }
              },
              required: ['hotel_id', 'room_type', 'check_in', 'check_out', 'rooms']
            }
          }
        ]
      }
    });
  }
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    try {
      let result;
      
      switch (name) {
        case 'search_hotels':
          result = searchHotels(args);
          break;
        case 'get_hotel_details':
          result = getHotelDetails(args);
          break;
        case 'check_availability':
          result = checkAvailability(args);
          break;
        case 'lock_inventory':
          result = lockInventory(args);
          break;
        case 'confirm_booking':
          result = confirmBooking(args);
          break;
        default:
          throw new Error(\`Unknown tool: \${name}\`);
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

function searchHotels({ location, check_in, check_out, guests = 2, client_id }) {
  const cityHotels = hotelsByCity[location] || [];
  const results = cityHotels.filter(hotel => {
    return hotel.room_types.some(room => room.max_occupancy >= guests);
  }).map(hotel => ({
    property_id: hotel.property_id,
    name: hotel.name,
    star_rating: hotel.star_rating,
    rating: hotel.rating,
    amenities: hotel.amenities,
    room_types: hotel.room_types.filter(r => r.max_occupancy >= guests)
  }));
  
  return { hotels: results, count: results.length };
}

function getHotelDetails({ hotel_id }) {
  const hotel = hotelsById[hotel_id];
  if (!hotel) throw new Error('Hotel not found');
  return hotel;
}

function checkAvailability({ hotel_id, room_type, check_in, check_out, rooms = 1 }) {
  const availability = availabilityState[hotel_id];
  if (!availability) return { available: false };
  
  const nights = getDatesInRange(check_in, check_out);
  const minAvailable = Math.min(...nights.map(date => availability[date]?.[room_type] || 0));
  
  return {
    available: minAvailable >= rooms,
    available_rooms: minAvailable,
    requested: rooms
  };
}

function lockInventory({ hotel_id, room_type, check_in, check_out, rooms, session_id }) {
  const { available } = checkAvailability({ hotel_id, room_type, check_in, check_out, rooms });
  if (!available) throw new Error('Not enough rooms available');
  
  return {
    lock_id: \`lock_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  };
}

function confirmBooking({ hotel_id, room_type, check_in, check_out, rooms }) {
  const nights = getDatesInRange(check_in, check_out);
  const availability = availabilityState[hotel_id];
  
  nights.forEach(date => {
    if (availability[date] && availability[date][room_type]) {
      availability[date][room_type] -= rooms;
    }
  });
  
  return { confirmed: true, confirmation_number: \`HTL-\${Date.now()}\` };
}

function getDatesInRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  
  while (current < endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'hotel-mcp', hotels_loaded: Object.keys(hotelsById).length });
});

loadHotelData();
initializeAvailability();

app.listen(PORT, () => {
  console.log(\`🏨 Hotel MCP Server running on http://localhost:\${PORT}\`);
});
`;

ensureDir('/home/claude/hospitality-mcp-servers/src/hotel-mcp');
fs.writeFileSync('/home/claude/hospitality-mcp-servers/src/hotel-mcp/server.js', hotelMCPServer);
console.log('✅ Created Hotel MCP Server');

// ============================================================================
// ORCHESTRATOR MCP SERVER  
// ============================================================================

const orchestratorMCPServer = `const express = require('express');
const axios = require('axios');
const { supabase } = require('../../config/supabase');
require('dotenv').config();

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3000;

app.use(express.json());

// Child MCP endpoints
const childMCPs = {
  hotel: \`http://localhost:\${process.env.HOTEL_MCP_PORT || 3001}/mcp\`,
  restaurant: \`http://localhost:\${process.env.RESTAURANT_MCP_PORT || 3002}/mcp\`,
  user: \`http://localhost:\${process.env.USER_MCP_PORT || 3003}/mcp\`,
  partner: \`http://localhost:\${process.env.PARTNER_MCP_PORT || 3004}/mcp\`
};

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        tools: [
          { name: 'session_create', description: 'Create new session' },
          { name: 'search_hotels', description: 'Search hotels via Hotel MCP' },
          { name: 'search_restaurants', description: 'Search restaurants via Restaurant MCP' },
          { name: 'cart_add_item', description: 'Add item to cart' },
          { name: 'cart_get', description: 'Get cart contents' },
          { name: 'booking_create', description: 'Create booking' }
        ]
      }
    });
  }
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    try {
      let result;
      
      if (name === 'session_create') {
        result = await createSession(args);
      } else if (name === 'search_hotels') {
        result = await callChildMCP('hotel', 'search_hotels', args);
      } else if (name === 'search_restaurants') {
        result = await callChildMCP('restaurant', 'search_restaurants', args);
      } else if (name === 'cart_add_item') {
        result = await addToCart(args);
      } else if (name === 'cart_get') {
        result = await getCart(args);
      } else {
        throw new Error(\`Unknown tool: \${name}\`);
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
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('client_id', client_id)
    .single();
  
  if (!client) throw new Error('Client not found');
  if (!client.allowed_domains.includes(domain)) {
    throw new Error('Domain not authorized');
  }
  
  const session_id = \`sess_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await supabase.from('sessions').insert({
    session_id,
    client_id,
    session_type: 'anonymous',
    expires_at: expires_at.toISOString()
  });
  
  return { session_id, client_config: client.branding_config };
}

async function addToCart({ session_id, item }) {
  let { data: cart } = await supabase
    .from('carts')
    .select('*')
    .eq('session_id', session_id)
    .single();
  
  if (!cart) {
    const { data: newCart } = await supabase
      .from('carts')
      .insert({
        session_id,
        client_id: item.client_id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();
    cart = newCart;
  }
  
  await supabase.from('cart_items').insert({
    cart_id: cart.cart_id,
    ...item
  });
  
  return { success: true, cart_id: cart.cart_id };
}

async function getCart({ session_id }) {
  const { data: cart } = await supabase
    .from('carts')
    .select(\`
      *,
      cart_items(*)
    \`)
    .eq('session_id', session_id)
    .single();
  
  return cart || { cart_items: [] };
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'orchestrator-mcp' });
});

app.listen(PORT, () => {
  console.log(\`🎯 Orchestrator MCP Server running on http://localhost:\${PORT}\`);
});
`;

ensureDir('/home/claude/hospitality-mcp-servers/src/orchestrator-mcp');
fs.writeFileSync('/home/claude/hospitality-mcp-servers/src/orchestrator-mcp/server.js', orchestratorMCPServer);
console.log('✅ Created Orchestrator MCP Server');

// Create package.json with axios dependency
const orch_package = {
  "name": "orchestrator-mcp",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.2",
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^16.3.1"
  }
};
fs.writeFileSync('/home/claude/hospitality-mcp-servers/src/orchestrator-mcp/package.json', JSON.stringify(orch_package, null, 2));

// ============================================================================
// RESTAURANT MCP SERVER
// ============================================================================

const restaurantMCPServer = `const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.RESTAURANT_MCP_PORT || 3002;

app.use(express.json());

let restaurantsData = {};
let restaurantsByCity = {};
let restaurantsById = {};

function loadRestaurantData() {
  const cities = ['dubai', 'london', 'newyork', 'singapore', 'newdelhi'];
  
  cities.forEach(city => {
    const filePath = path.join(__dirname, \`../../mock-data/restaurants/\${city}-restaurants.json\`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    restaurantsData[city] = data;
    restaurantsByCity[data.city] = data.restaurants;
    
    data.restaurants.forEach(restaurant => {
      restaurantsById[restaurant.property_id] = restaurant;
    });
  });
  
  console.log(\`✅ Loaded \${Object.keys(restaurantsById).length} restaurants\`);
}

app.post('/mcp', (req, res) => {
  const { method, params } = req.body;
  
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        tools: [
          { name: 'search_restaurants', description: 'Search restaurants' },
          { name: 'get_restaurant_details', description: 'Get restaurant details' },
          { name: 'check_table_availability', description: 'Check table availability' }
        ]
      }
    });
  }
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    try {
      let result;
      
      if (name === 'search_restaurants') {
        const cityRestaurants = restaurantsByCity[args.location] || [];
        result = { restaurants: cityRestaurants.slice(0, 10), count: cityRestaurants.length };
      } else if (name === 'get_restaurant_details') {
        result = restaurantsById[args.restaurant_id] || null;
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

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'restaurant-mcp' });
});

loadRestaurantData();

app.listen(PORT, () => {
  console.log(\`🍽️  Restaurant MCP Server running on http://localhost:\${PORT}\`);
});
`;

ensureDir('/home/claude/hospitality-mcp-servers/src/restaurant-mcp');
fs.writeFileSync('/home/claude/hospitality-mcp-servers/src/restaurant-mcp/server.js', restaurantMCPServer);
console.log('✅ Created Restaurant MCP Server');

// ============================================================================
// USER MCP SERVER
// ============================================================================

const userMCPServer = `const express = require('express');
const { supabase } = require('../../config/supabase');
require('dotenv').config();

const app = express();
const PORT = process.env.USER_MCP_PORT || 3003;

app.use(express.json());

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        tools: [
          { name: 'create_user', description: 'Create user profile' },
          { name: 'get_user_by_email', description: 'Get user by email' }
        ]
      }
    });
  }
  
  if (method === 'tools/call') {
    try {
      const { name, arguments: args } = params;
      let result;
      
      if (name === 'create_user') {
        const { data } = await supabase.from('users').insert(args).select().single();
        result = data;
      } else if (name === 'get_user_by_email') {
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

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-mcp' });
});

app.listen(PORT, () => {
  console.log(\`👤 User MCP Server running on http://localhost:\${PORT}\`);
});
`;

ensureDir('/home/claude/hospitality-mcp-servers/src/user-mcp');
fs.writeFileSync('/home/claude/hospitality-mcp-servers/src/user-mcp/server.js', userMCPServer);
console.log('✅ Created User MCP Server');

// ============================================================================
// PARTNER MCP SERVER
// ============================================================================

const partnerMCPServer = `const express = require('express');
const { supabase } = require('../../config/supabase');
require('dotenv').config();

const app = express();
const PORT = process.env.PARTNER_MCP_PORT || 3004;

app.use(express.json());

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        tools: [
          { name: 'get_partner_properties', description: 'Get partner properties for client' }
        ]
      }
    });
  }
  
  if (method === 'tools/call') {
    try {
      const { name, arguments: args } = params;
      let result = { partners: [] };
      
      if (name === 'get_partner_properties') {
        const { data } = await supabase
          .from('partner_relationships')
          .select('*')
          .eq('client_id', args.client_id)
          .eq('is_active', true);
        result = { partners: data || [] };
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

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'partner-mcp' });
});

app.listen(PORT, () => {
  console.log(\`🤝 Partner MCP Server running on http://localhost:\${PORT}\`);
});
`;

ensureDir('/home/claude/hospitality-mcp-servers/src/partner-mcp');
fs.writeFileSync('/home/claude/hospitality-mcp-servers/src/partner-mcp/server.js', partnerMCPServer);
console.log('✅ Created Partner MCP Server');

console.log('\n🎉 All MCP servers generated successfully!\n');
console.log('Next steps:');
console.log('1. npm install');
console.log('2. cp .env.example .env (and configure)');
console.log('3. npm run start:all');

