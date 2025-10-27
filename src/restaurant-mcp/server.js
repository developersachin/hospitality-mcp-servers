const express = require('express');
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
    const filePath = path.join(__dirname, `../../mock-data/restaurants/${city}-restaurants.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    restaurantsData[city] = data;
    restaurantsByCity[data.city] = data.restaurants;
    
    data.restaurants.forEach(restaurant => {
      restaurantsById[restaurant.property_id] = restaurant;
    });
  });
  
  console.log(`✅ Loaded ${Object.keys(restaurantsById).length} restaurants`);
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
  console.log(`🍽️  Restaurant MCP Server running on http://localhost:${PORT}`);
});
