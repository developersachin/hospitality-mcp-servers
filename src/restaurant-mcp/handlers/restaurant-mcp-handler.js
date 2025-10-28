const express = require('express');
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
    const filePath = path.join(__dirname, `../mock-data/restaurants/${city}-restaurants.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    restaurantsByCity[data.city] = data.restaurants;
    data.restaurants.forEach(r => { restaurantsById[r.property_id] = r; });
  });
  console.log(`✅ Loaded ${Object.keys(restaurantsById).length} restaurants`);
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
