const express = require("express");
const serverless = require("serverless-http");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

let restaurantsByCity = {};
let restaurantsById = {};

// City name mapping for case-insensitive lookup
const cityMapping = {
  dubai: "Dubai",
  london: "London",
  newyork: "New York",
  singapore: "Singapore",
  newdelhi: "New Delhi",
};

function normalizeLocation(location) {
  if (!location) return null;
  const lower = location.toLowerCase().replace(/\s+/g, "");
  return cityMapping[lower] || location;
}

function loadRestaurantData() {
  const cities = ["dubai", "london", "newyork", "singapore", "newdelhi"];
  cities.forEach((city) => {
    const filePath = path.join(
      __dirname,
      `../mock-data/restaurants/${city}-restaurants.json`
    );
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    restaurantsByCity[data.city] = data.restaurants;
    data.restaurants.forEach((r) => {
      restaurantsById[r.property_id] = r;
    });
  });
  console.log(`✅ Loaded ${Object.keys(restaurantsById).length} restaurants`);
}

loadRestaurantData();

app.get("*/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "restaurant-mcp-lambda",
    restaurants: Object.keys(restaurantsById).length,
  });
});

app.post("*/mcp", (req, res) => {
  const { method, params } = req.body;
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          { name: "search_restaurants", description: "Search restaurants" },
        ],
      },
    });
  }
  if (method === "tools/call") {
    const { name, arguments: args } = params;
    try {
      if (name === "search_restaurants") {
        const normalizedLocation = normalizeLocation(args.location);
        const cityRestaurants = restaurantsByCity[normalizedLocation] || [];
        const result = {
          restaurants: cityRestaurants.slice(0, 10),
          count: cityRestaurants.length,
        };
        res.json({
          jsonrpc: "2.0",
          id: req.body.id,
          result: { content: [{ type: "text", text: JSON.stringify(result) }] },
        });
      } else {
        res.json({
          jsonrpc: "2.0",
          id: req.body.id,
          error: { code: -32000, message: `Unknown tool: ${name}` },
        });
      }
    } catch (error) {
      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32000, message: error.message },
      });
    }
  }
});

module.exports.handler = serverless(app);
