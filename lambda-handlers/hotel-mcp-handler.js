const express = require('express');
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
    const filePath = path.join(__dirname, `../mock-data/hotels/${city}-hotels.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    hotelsData[city] = data;
    hotelsByCity[data.city] = data.hotels;
    data.hotels.forEach(hotel => {
      hotelsById[hotel.property_id] = hotel;
      availabilityState[hotel.property_id] = JSON.parse(JSON.stringify(hotel.availability_calendar));
    });
  });
  console.log(`✅ Loaded ${Object.keys(hotelsById).length} hotels`);
}

loadHotelData();

// Handle both /health and /hotel/health
app.get('*/health', (req, res) => {
  res.json({ status: 'healthy', service: 'hotel-mcp-lambda', hotels: Object.keys(hotelsById).length });
});

// Handle both /mcp and /hotel/mcp
app.post('*/mcp', (req, res) => {
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
