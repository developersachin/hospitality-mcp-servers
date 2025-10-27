const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.HOTEL_MCP_PORT || 3001;

app.use(express.json());

// Load all hotel data into memory
let hotelsData = {};
let hotelsByCity = {};
let hotelsById = {};

function loadHotelData() {
  const cities = ["dubai", "london", "newyork", "singapore", "newdelhi"];

  cities.forEach((city) => {
    const filePath = path.join(
      __dirname,
      `../../mock-data/hotels/${city}-hotels.json`
    );
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    hotelsData[city] = data;
    hotelsByCity[data.city] = data.hotels;

    data.hotels.forEach((hotel) => {
      hotelsById[hotel.property_id] = hotel;
    });
  });

  console.log(`✅ Loaded ${Object.keys(hotelsById).length} hotels`);
}

// In-memory availability tracking
let availabilityState = {};

function initializeAvailability() {
  Object.values(hotelsById).forEach((hotel) => {
    availabilityState[hotel.property_id] = JSON.parse(
      JSON.stringify(hotel.availability_calendar)
    );
  });
}

// MCP Protocol endpoint
app.post("/mcp", (req, res) => {
  const { method, params } = req.body;

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          {
            name: "search_hotels",
            description: "Search for hotels by location and dates",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
                check_in: { type: "string" },
                check_out: { type: "string" },
                guests: { type: "number" },
                client_id: { type: "string" },
              },
              required: ["location", "check_in", "check_out", "client_id"],
            },
          },
          {
            name: "get_hotel_details",
            description: "Get detailed information about a specific hotel",
            inputSchema: {
              type: "object",
              properties: {
                hotel_id: { type: "string" },
                client_id: { type: "string" },
              },
              required: ["hotel_id", "client_id"],
            },
          },
          {
            name: "check_availability",
            description: "Check room availability for specific dates",
            inputSchema: {
              type: "object",
              properties: {
                hotel_id: { type: "string" },
                room_type: { type: "string" },
                check_in: { type: "string" },
                check_out: { type: "string" },
                rooms: { type: "number" },
              },
              required: ["hotel_id", "room_type", "check_in", "check_out"],
            },
          },
          {
            name: "lock_inventory",
            description: "Create temporary hold on rooms",
            inputSchema: {
              type: "object",
              properties: {
                hotel_id: { type: "string" },
                room_type: { type: "string" },
                check_in: { type: "string" },
                check_out: { type: "string" },
                rooms: { type: "number" },
                session_id: { type: "string" },
              },
              required: [
                "hotel_id",
                "room_type",
                "check_in",
                "check_out",
                "rooms",
                "session_id",
              ],
            },
          },
          {
            name: "confirm_booking",
            description: "Confirm booking and update availability",
            inputSchema: {
              type: "object",
              properties: {
                hotel_id: { type: "string" },
                room_type: { type: "string" },
                check_in: { type: "string" },
                check_out: { type: "string" },
                rooms: { type: "number" },
              },
              required: [
                "hotel_id",
                "room_type",
                "check_in",
                "check_out",
                "rooms",
              ],
            },
          },
        ],
      },
    });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;

      switch (name) {
        case "search_hotels":
          result = searchHotels(args);
          break;
        case "get_hotel_details":
          result = getHotelDetails(args);
          break;
        case "check_availability":
          result = checkAvailability(args);
          break;
        case "lock_inventory":
          result = lockInventory(args);
          break;
        case "confirm_booking":
          result = confirmBooking(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }] },
      });
    } catch (error) {
      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32000, message: error.message },
      });
    }
  }
});

function searchHotels({
  location,
  check_in,
  check_out,
  guests = 2,
  client_id,
}) {
  const cityHotels = hotelsByCity[location] || [];
  const results = cityHotels
    .filter((hotel) => {
      return hotel.room_types.some((room) => room.max_occupancy >= guests);
    })
    .map((hotel) => ({
      property_id: hotel.property_id,
      name: hotel.name,
      star_rating: hotel.star_rating,
      rating: hotel.rating,
      amenities: hotel.amenities,
      room_types: hotel.room_types.filter((r) => r.max_occupancy >= guests),
    }));

  return { hotels: results, count: results.length };
}

function getHotelDetails({ hotel_id }) {
  const hotel = hotelsById[hotel_id];
  if (!hotel) throw new Error("Hotel not found");
  return hotel;
}

function checkAvailability({
  hotel_id,
  room_type,
  check_in,
  check_out,
  rooms = 1,
}) {
  const availability = availabilityState[hotel_id];
  if (!availability) return { available: false };

  const nights = getDatesInRange(check_in, check_out);
  const minAvailable = Math.min(
    ...nights.map((date) => availability[date]?.[room_type] || 0)
  );

  return {
    available: minAvailable >= rooms,
    available_rooms: minAvailable,
    requested: rooms,
  };
}

function lockInventory({
  hotel_id,
  room_type,
  check_in,
  check_out,
  rooms,
  session_id,
}) {
  const { available } = checkAvailability({
    hotel_id,
    room_type,
    check_in,
    check_out,
    rooms,
  });
  if (!available) throw new Error("Not enough rooms available");

  return {
    lock_id: `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

function confirmBooking({ hotel_id, room_type, check_in, check_out, rooms }) {
  const nights = getDatesInRange(check_in, check_out);
  const availability = availabilityState[hotel_id];

  nights.forEach((date) => {
    if (availability[date] && availability[date][room_type]) {
      availability[date][room_type] -= rooms;
    }
  });

  return { confirmed: true, confirmation_number: `HTL-${Date.now()}` };
}

function getDatesInRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current < endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "hotel-mcp",
    hotels_loaded: Object.keys(hotelsById).length,
  });
});

loadHotelData();
initializeAvailability();

app.listen(PORT, () => {
  console.log(`🏨 Hotel MCP Server running on http://localhost:${PORT}`);
});
