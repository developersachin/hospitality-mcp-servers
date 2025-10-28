const express = require("express");
const serverless = require("serverless-http");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Child MCP endpoints (Lambda URLs - will be configured after deployment)
const childMCPs = {
  hotel: process.env.HOTEL_MCP_URL,
  restaurant: process.env.RESTAURANT_MCP_URL,
  user: process.env.USER_MCP_URL,
  partner: process.env.PARTNER_MCP_URL,
};

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "orchestrator-mcp-lambda" });
});

app.post("/mcp", async (req, res) => {
  const { method, params } = req.body;

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          { name: "session_create", description: "Create new session" },
          { name: "search_hotels", description: "Search hotels" },
          { name: "search_restaurants", description: "Search restaurants" },
          { name: "cart_add_item", description: "Add item to cart" },
          { name: "cart_get", description: "Get cart contents" },
        ],
      },
    });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;

      switch (name) {
        case "session_create":
          result = await createSession(args);
          break;
        case "search_hotels":
          result = await callChildMCP("hotel", "search_hotels", args);
          break;
        case "search_restaurants":
          result = await callChildMCP("restaurant", "search_restaurants", args);
          break;
        case "cart_add_item":
          result = await addToCart(args);
          break;
        case "cart_get":
          result = await getCart(args);
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

async function callChildMCP(mcpName, tool, args) {
  const response = await axios.post(childMCPs[mcpName], {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: { name: tool, arguments: args },
  });
  return JSON.parse(response.data.result.content[0].text);
}

async function createSession({ client_id, domain }) {
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("client_id", client_id)
    .single();

  if (!client) throw new Error("Client not found");
  if (!client.allowed_domains.includes(domain)) {
    throw new Error("Domain not authorized");
  }

  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      client_id,
      session_type: "anonymous",
      expires_at: expires_at.toISOString(),
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error("Failed to create session");
  }

  return {
    session_id: session.session_id,
    client_config: client.branding_config,
  };
}

async function addToCart({ session_id, item }) {
  const { data: existingCarts } = await supabase
    .from("carts")
    .select("*")
    .eq("session_id", session_id)
    .eq("status", "active");

  let cart;

  if (existingCarts && existingCarts.length > 0) {
    cart = existingCarts[0];
  } else {
    const { data: newCart } = await supabase
      .from("carts")
      .insert({
        session_id,
        client_id: item.client_id,
        status: "active",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    cart = newCart;
  }

  await supabase.from("cart_items").insert({
    cart_id: cart.cart_id,
    property_id: item.property_id,
    property_type: item.property_type,
    is_partner: item.is_partner,
    service_details: item.service_details,
    unit_price: item.unit_price,
    quantity: item.quantity || 1,
    total_price: item.total_price,
    currency: item.currency || "USD",
  });

  return { success: true, cart_id: cart.cart_id };
}

async function getCart({ session_id }) {
  const { data: carts } = await supabase
    .from("carts")
    .select("*, cart_items (*)")
    .eq("session_id", session_id)
    .eq("status", "active");

  return carts && carts.length > 0 ? carts[0] : { cart_items: [] };
}

module.exports.handler = serverless(app);
