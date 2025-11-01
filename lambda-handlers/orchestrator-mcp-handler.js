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

// Child MCP endpoints from environment
const childMCPs = {
  hotel: process.env.HOTEL_MCP_URL,
  restaurant: process.env.RESTAURANT_MCP_URL,
  user: process.env.USER_MCP_URL,
  partner: process.env.PARTNER_MCP_URL,
};

// ==================================================
// LOCATION NORMALIZATION HELPERS
// ==================================================
function normalizeLocation(location) {
  if (!location) return "";

  const loc = location.toLowerCase().trim();

  // Map famous landmarks/areas to their cities
  const locationMap = {
    // Dubai
    "burj khalifa": "dubai",
    "burj al arab": "dubai",
    "downtown dubai": "dubai",
    "dubai marina": "dubai",
    "palm jumeirah": "dubai",
    deira: "dubai",
    jbr: "dubai",
    "jumeirah beach": "dubai",
    "business bay": "dubai",
    "dubai mall": "dubai",

    // New York
    "times square": "new york",
    manhattan: "new york",
    brooklyn: "new york",
    "central park": "new york",
    "empire state building": "new york",
    "statue of liberty": "new york",

    // Paris
    "eiffel tower": "paris",
    "champs elysees": "paris",
    "champs-élysées": "paris",
    montmartre: "paris",
    louvre: "paris",
    "arc de triomphe": "paris",

    // London
    "big ben": "london",
    "tower bridge": "london",
    westminster: "london",
    "buckingham palace": "london",
    "london eye": "london",

    // Singapore
    "marina bay sands": "singapore",
    sentosa: "singapore",
    "orchard road": "singapore",

    // Tokyo
    shibuya: "tokyo",
    shinjuku: "tokyo",
    roppongi: "tokyo",
    "tokyo tower": "tokyo",

    // Add more mappings as needed
  };

  // Check if location contains any mapped landmark
  for (const [landmark, city] of Object.entries(locationMap)) {
    if (loc.includes(landmark)) {
      console.log(`📍 Location normalized: "${location}" → "${city}"`);
      return city;
    }
  }

  // Remove country/state info (keep first part before comma)
  const parts = loc.split(",");
  const normalized = parts[0].trim();

  if (normalized !== loc) {
    console.log(`📍 Location cleaned: "${location}" → "${normalized}"`);
  }

  return normalized;
}

// ==================================================
// HEALTH CHECK
// ==================================================
app.get("*/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "orchestrator-mcp-lambda",
    tools: 12,
    timestamp: new Date().toISOString(),
  });
});

// ==================================================
// MCP PROTOCOL ENDPOINT
// ==================================================
app.post("*/mcp", async (req, res) => {
  const { method, params } = req.body;

  // TOOLS/LIST
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          { name: "session_create", description: "Create new user session" },
          { name: "session_get", description: "Get existing session details" },
          { name: "search_hotels", description: "Search for hotels" },
          {
            name: "hotel_details_get",
            description: "Get detailed hotel information",
          },
          { name: "search_restaurants", description: "Search for restaurants" },
          {
            name: "restaurant_details_get",
            description: "Get detailed restaurant information",
          },
          { name: "cart_add_item", description: "Add item to cart" },
          { name: "cart_get", description: "Get cart contents" },
          { name: "cart_remove_item", description: "Remove item from cart" },
          {
            name: "conversation_history_get",
            description: "Get conversation history",
          },
          { name: "context_add", description: "Add message to conversation" },
          {
            name: "partner_properties_get",
            description: "Get partner recommendations",
          },
        ],
      },
    });
  }

  // TOOLS/CALL
  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;

      switch (name) {
        case "session_create":
          result = await createSession(args);
          break;
        case "session_get":
          result = await getSession(args);
          break;
        case "search_hotels":
          // Normalize location before calling child MCP
          const normalizedHotelArgs = { ...args };
          if (args.location) {
            normalizedHotelArgs.location = normalizeLocation(args.location);
          }
          console.log(
            "🏨 Search hotels with normalized args:",
            normalizedHotelArgs
          );
          result = await callChildMCP(
            "hotel",
            "search_hotels",
            normalizedHotelArgs
          );
          break;
        case "hotel_details_get":
          result = await callChildMCP("hotel", "get_hotel_details", args);
          break;
        case "search_restaurants":
          // Normalize location for restaurants too
          const normalizedRestArgs = { ...args };
          if (args.location) {
            normalizedRestArgs.location = normalizeLocation(args.location);
          }
          console.log(
            "🍽️ Search restaurants with normalized args:",
            normalizedRestArgs
          );
          result = await callChildMCP(
            "restaurant",
            "search_restaurants",
            normalizedRestArgs
          );
          break;
        case "restaurant_details_get":
          result = await callChildMCP(
            "restaurant",
            "get_restaurant_details",
            args
          );
          break;
        case "cart_add_item":
          result = await cartAddItem(args);
          break;
        case "cart_get":
          result = await cartGet(args);
          break;
        case "cart_remove_item":
          result = await cartRemoveItem(args);
          break;
        case "conversation_history_get":
          result = await getConversationHistory(args);
          break;
        case "context_add":
          result = await addContext(args);
          break;
        case "partner_properties_get":
          // Normalize location for partner properties
          const normalizedPartnerArgs = { ...args };
          if (args.location) {
            normalizedPartnerArgs.location = normalizeLocation(args.location);
          }
          result = await callChildMCP(
            "partner",
            "get_partner_properties",
            normalizedPartnerArgs
          );
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
      console.error(`Tool execution error (${name}):`, error);
      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32000, message: error.message },
      });
    }
  }
});

// ==================================================
// HELPER: CALL CHILD MCP
// ==================================================
async function callChildMCP(mcpName, tool, args) {
  try {
    const response = await axios.post(childMCPs[mcpName], {
      jsonrpc: "2.0",
      id: "1",
      method: "tools/call",
      params: { name: tool, arguments: args },
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return JSON.parse(response.data.result.content[0].text);
  } catch (error) {
    console.error(`Error calling ${mcpName} MCP:`, error);
    throw error;
  }
}

// ==================================================
// SESSION OPERATIONS
// ==================================================
async function createSession(args) {
  const { client_id, domain } = args;

  try {
    // Validate client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("client_id, name, allowed_domains, branding_config, status")
      .eq("client_id", client_id)
      .single();

    if (clientError || !client) {
      return { success: false, error: "Client not found" };
    }

    if (client.status !== "active") {
      return { success: false, error: "Client is not active" };
    }

    if (!client.allowed_domains || !client.allowed_domains.includes(domain)) {
      return { success: false, error: `Domain ${domain} not authorized` };
    }

    // Create session
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        client_id: client.client_id,
        domain,
        session_type: "anonymous",
        status: "active",
        context: {},
        last_active: new Date().toISOString(),
        expires_at: expires_at.toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return { success: false, error: "Failed to create session" };
    }

    return {
      success: true,
      session_id: session.session_id,
      client_id: session.client_id,
      session_type: session.session_type,
      expires_at: session.expires_at,
      created_at: session.created_at,
    };
  } catch (error) {
    console.error("Create session error:", error);
    return { success: false, error: error.message };
  }
}

async function getSession(args) {
  const { session_id } = args;

  try {
    const { data: session, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("session_id", session_id)
      .single();

    if (error || !session) {
      return { success: false, error: "Session not found" };
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (expiresAt < now) {
      await supabase
        .from("sessions")
        .update({ status: "expired" })
        .eq("session_id", session_id);
      return { success: false, error: "Session expired" };
    }

    // Update last_active
    await supabase
      .from("sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("session_id", session_id);

    return {
      success: true,
      session_id: session.session_id,
      client_id: session.client_id,
      domain: session.domain,
      session_type: session.session_type,
      status: session.status,
      expires_at: session.expires_at,
    };
  } catch (error) {
    console.error("Get session error:", error);
    return { success: false, error: error.message };
  }
}

// ==================================================
// CART OPERATIONS (DB-ALIGNED)
// ==================================================
async function cartAddItem(args) {
  const {
    session_id,
    property_id,
    property_type,
    is_partner = false,
    service_details,
    unit_price,
    quantity = 1,
    total_price,
    currency = "USD",
  } = args;

  try {
    // Step 1: Get client_id from session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("client_id, status")
      .eq("session_id", session_id)
      .single();

    if (sessionError || !session) {
      return { success: false, error: "Session not found" };
    }

    if (session.status !== "active") {
      return { success: false, error: "Session is not active" };
    }

    // Step 2: Get or create cart
    let cart;
    const { data: existingCarts } = await supabase
      .from("carts")
      .select("cart_id, session_id, client_id, status")
      .eq("session_id", session_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingCarts && existingCarts.length > 0) {
      cart = existingCarts[0];
    } else {
      // Create new cart with client_id from session
      const { data: newCart, error: cartError } = await supabase
        .from("carts")
        .insert({
          session_id,
          client_id: session.client_id,
          status: "active",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (cartError) {
        console.error("Cart creation error:", cartError);
        return { success: false, error: "Failed to create cart" };
      }
      cart = newCart;
    }

    // Step 3: Insert into cart_items table
    const { data: cartItem, error: itemError } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cart.cart_id,
        property_id,
        property_type,
        is_partner,
        service_details,
        unit_price: parseFloat(unit_price),
        quantity: parseInt(quantity),
        total_price: parseFloat(total_price),
        currency,
      })
      .select()
      .single();

    if (itemError) {
      console.error("Cart item insert error:", itemError);
      return { success: false, error: "Failed to add item to cart" };
    }

    return {
      success: true,
      cart_id: cart.cart_id,
      cart_item_id: cartItem.cart_item_id,
      message: "Item added to cart successfully",
    };
  } catch (error) {
    console.error("Add to cart error:", error);
    return { success: false, error: error.message };
  }
}

async function cartGet(args) {
  const { session_id } = args;

  try {
    // Get cart with items using JOIN
    const { data: carts, error } = await supabase
      .from("carts")
      .select(
        `
        cart_id,
        session_id,
        client_id,
        status,
        expires_at,
        created_at,
        cart_items (
          cart_item_id,
          property_id,
          property_type,
          is_partner,
          service_details,
          unit_price,
          quantity,
          total_price,
          currency,
          created_at
        )
      `
      )
      .eq("session_id", session_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Get cart error:", error);
      return { success: false, error: error.message };
    }

    // Return empty cart if none exists
    if (!carts || carts.length === 0) {
      return {
        success: true,
        cart_id: null,
        items: [],
        total: "0.00",
        currency: "USD",
        item_count: 0,
      };
    }

    const cart = carts[0];
    const items = cart.cart_items || [];

    // Calculate total
    const total = items.reduce((sum, item) => {
      return sum + (parseFloat(item.total_price) || 0);
    }, 0);

    return {
      success: true,
      cart_id: cart.cart_id,
      session_id: cart.session_id,
      items: items,
      total: total.toFixed(2),
      currency: items[0]?.currency || "USD",
      item_count: items.length,
      expires_at: cart.expires_at,
    };
  } catch (error) {
    console.error("Get cart error:", error);
    return { success: false, error: error.message };
  }
}

async function cartRemoveItem(args) {
  const { session_id, cart_item_id } = args;

  try {
    // Verify cart belongs to session
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("cart_id")
      .eq("session_id", session_id)
      .eq("status", "active")
      .single();

    if (cartError || !cart) {
      return { success: false, error: "Cart not found" };
    }

    // Delete cart item
    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_item_id", cart_item_id)
      .eq("cart_id", cart.cart_id);

    if (deleteError) {
      console.error("Delete cart item error:", deleteError);
      return { success: false, error: "Failed to remove item" };
    }

    return {
      success: true,
      message: "Item removed successfully",
    };
  } catch (error) {
    console.error("Remove from cart error:", error);
    return { success: false, error: error.message };
  }
}

// ==================================================
// CONVERSATION CONTEXT OPERATIONS
// ==================================================
async function addContext(args) {
  const { session_id, role, content, intent, entities } = args;

  try {
    const { data: context, error } = await supabase
      .from("conversation_context")
      .insert({
        session_id,
        role,
        content,
        intent,
        entities: entities || {},
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Add context error:", error);
      return { success: false, error: "Failed to save context" };
    }

    return {
      success: true,
      context_id: context.context_id,
      session_id: session_id,
      message: "Context saved successfully",
    };
  } catch (error) {
    console.error("Add context error:", error);
    return { success: false, error: error.message };
  }
}

async function getConversationHistory(args) {
  const { session_id, limit = 20 } = args;

  try {
    const { data: history, error } = await supabase
      .from("conversation_context")
      .select("*")
      .eq("session_id", session_id)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Get conversation history error:", error);
      return { success: false, error: error.message };
    }

    return history.reverse(); // Return chronological order
  } catch (error) {
    console.error("Get conversation history error:", error);
    return { success: false, error: error.message };
  }
}

// ==================================================
// EXPORT LAMBDA HANDLER
// ==================================================
module.exports.handler = serverless(app);
