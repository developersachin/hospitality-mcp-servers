const express = require("express");
const axios = require("axios");
const { supabase } = require("../../config/supabase");
require("dotenv").config({ path: "../../.env" });

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3000;

app.use(express.json());

// Child MCP endpoints
const childMCPs = {
  hotel: `http://localhost:${process.env.HOTEL_MCP_PORT || 3001}/mcp`,
  restaurant: `http://localhost:${process.env.RESTAURANT_MCP_PORT || 3002}/mcp`,
  user: `http://localhost:${process.env.USER_MCP_PORT || 3003}/mcp`,
  partner: `http://localhost:${process.env.PARTNER_MCP_PORT || 3004}/mcp`,
};

app.post("/mcp", async (req, res) => {
  const { method, params } = req.body;

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          { name: "session_create", description: "Create new session" },
          { name: "search_hotels", description: "Search hotels via Hotel MCP" },
          {
            name: "search_restaurants",
            description: "Search restaurants via Restaurant MCP",
          },
          { name: "cart_add_item", description: "Add item to cart" },
          { name: "cart_get", description: "Get cart contents" },
          { name: "booking_create", description: "Create booking" },
        ],
      },
    });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;

      if (name === "session_create") {
        result = await createSession(args);
      } else if (name === "search_hotels") {
        result = await callChildMCP("hotel", "search_hotels", args);
      } else if (name === "search_restaurants") {
        result = await callChildMCP("restaurant", "search_restaurants", args);
      } else if (name === "cart_add_item") {
        result = await addToCart(args);
      } else if (name === "cart_get") {
        result = await getCart(args);
      } else {
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
    console.error("Session creation error:", error);
    throw new Error("Failed to create session");
  }

  return {
    session_id: session.session_id,
    client_config: client.branding_config,
  };
}

async function addToCart({ session_id, item }) {
  try {
    // Check if cart exists
    const { data: existingCarts, error: cartFetchError } = await supabase
      .from("carts")
      .select("*")
      .eq("session_id", session_id)
      .eq("status", "active");

    let cart;

    if (cartFetchError) {
      console.error("Cart fetch error:", cartFetchError);
      throw new Error(`Failed to fetch cart: ${cartFetchError.message}`);
    }

    // If cart exists, use it
    if (existingCarts && existingCarts.length > 0) {
      cart = existingCarts[0];
    } else {
      // Create new cart
      const { data: newCart, error: cartInsertError } = await supabase
        .from("carts")
        .insert({
          session_id,
          client_id: item.client_id,
          status: "active",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (cartInsertError || !newCart) {
        console.error("Cart creation error:", cartInsertError);
        throw new Error(
          `Failed to create cart: ${
            cartInsertError?.message || "Unknown error"
          }`
        );
      }

      cart = newCart;
    }

    if (!cart || !cart.cart_id) {
      throw new Error("Failed to get or create cart - cart_id is missing");
    }

    // Add item to cart
    const { error: itemInsertError } = await supabase
      .from("cart_items")
      .insert({
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

    if (itemInsertError) {
      console.error("Cart item insertion error:", itemInsertError);
      throw new Error(`Failed to add item to cart: ${itemInsertError.message}`);
    }

    return {
      success: true,
      cart_id: cart.cart_id,
      message: "Item added to cart successfully",
    };
  } catch (error) {
    console.error("Add to cart error:", error);
    throw error;
  }
}

async function getCart({ session_id }) {
  try {
    const { data: carts, error } = await supabase
      .from("carts")
      .select(
        `
        *,
        cart_items (*)
      `
      )
      .eq("session_id", session_id)
      .eq("status", "active");

    if (error) {
      console.error("Get cart error:", error);
      // Return empty cart instead of throwing error
      return { cart_items: [] };
    }

    if (!carts || carts.length === 0) {
      return { cart_items: [] };
    }

    return carts[0];
  } catch (error) {
    console.error("Get cart error:", error);
    return { cart_items: [] };
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "orchestrator-mcp" });
});

app.listen(PORT, () => {
  console.log(`🎯 Orchestrator MCP Server running on http://localhost:${PORT}`);
});
