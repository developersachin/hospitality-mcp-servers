const express = require("express");
const axios = require("axios");
const { supabase } = require("../../config/supabase");
require("dotenv").config({ path: "../../.env" });

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3000;

app.use(express.json());

// Child MCP endpoints - FIXED to use environment variables for Lambda
const childMCPs = {
  hotel:
    process.env.HOTEL_MCP_URL ||
    `http://localhost:${process.env.HOTEL_MCP_PORT || 3001}/mcp`,
  restaurant:
    process.env.RESTAURANT_MCP_URL ||
    `http://localhost:${process.env.RESTAURANT_MCP_PORT || 3002}/mcp`,
  user:
    process.env.USER_MCP_URL ||
    `http://localhost:${process.env.USER_MCP_PORT || 3003}/mcp`,
  partner:
    process.env.PARTNER_MCP_URL ||
    `http://localhost:${process.env.PARTNER_MCP_PORT || 3004}/mcp`,
};

// Log child MCP URLs on startup (helpful for debugging)
console.log("🔗 Child MCP URLs configured:", childMCPs);

// ============================================
// MCP PROTOCOL ENDPOINTS
// ============================================

app.post("/mcp", async (req, res) => {
  const { method, params } = req.body;

  // List all available tools
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          // Session Management
          {
            name: "session_create",
            description: "Create new session for user",
            inputSchema: {
              type: "object",
              properties: {
                client_id: { type: "string", description: "Client UUID" },
                domain: { type: "string", description: "Origin domain" },
              },
              required: ["client_id", "domain"],
            },
          },
          {
            name: "session_get",
            description: "Get existing session by session_id",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string", description: "Session UUID" },
              },
              required: ["session_id"],
            },
          },

          // Hotel Operations (delegates to Hotel MCP)
          {
            name: "search_hotels",
            description: "Search hotels by location and dates",
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
            name: "hotel_details_get",
            description: "Get detailed information about specific hotel",
            inputSchema: {
              type: "object",
              properties: {
                hotel_id: { type: "string" },
                client_id: { type: "string" },
              },
              required: ["hotel_id", "client_id"],
            },
          },

          // Restaurant Operations (delegates to Restaurant MCP)
          {
            name: "search_restaurants",
            description: "Search restaurants by location",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
                cuisine: { type: "string" },
                party_size: { type: "number" },
                client_id: { type: "string" },
              },
              required: ["location", "client_id"],
            },
          },
          {
            name: "restaurant_details_get",
            description: "Get detailed information about specific restaurant",
            inputSchema: {
              type: "object",
              properties: {
                restaurant_id: { type: "string" },
                client_id: { type: "string" },
              },
              required: ["restaurant_id", "client_id"],
            },
          },

          // Cart Operations (direct Supabase)
          {
            name: "cart_add_item",
            description: "Add item to shopping cart",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                item: { type: "object" },
              },
              required: ["session_id", "item"],
            },
          },
          {
            name: "cart_get",
            description: "Get current cart contents",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
              },
              required: ["session_id"],
            },
          },
          {
            name: "cart_remove_item",
            description: "Remove item from cart",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                item_id: { type: "string" },
              },
              required: ["session_id", "item_id"],
            },
          },

          // Conversation History (direct Supabase)
          {
            name: "conversation_history_get",
            description: "Get conversation history for session",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                limit: { type: "number", default: 20 },
              },
              required: ["session_id"],
            },
          },
          {
            name: "context_add",
            description: "Add message to conversation history",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                role: { type: "string", enum: ["user", "assistant"] },
                content: { type: "string" },
              },
              required: ["session_id", "role", "content"],
            },
          },

          // Partner Operations (delegates to Partner MCP)
          {
            name: "partner_properties_get",
            description: "Get partner properties for recommendations",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
                property_type: {
                  type: "string",
                  enum: ["hotel", "restaurant"],
                },
                client_id: { type: "string" },
              },
              required: ["location", "property_type", "client_id"],
            },
          },
        ],
      },
    });
  }

  // Execute tool calls
  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;

      // Route to appropriate handler
      switch (name) {
        // Session Management
        case "session_create":
          result = await createSession(args);
          break;
        case "session_get":
          result = await getSession(args);
          break;

        // Hotel Operations
        case "search_hotels":
          result = await callChildMCP("hotel", "search_hotels", args);
          break;
        case "hotel_details_get":
          result = await callChildMCP("hotel", "get_hotel_details", args);
          break;

        // Restaurant Operations
        case "search_restaurants":
          result = await callChildMCP("restaurant", "search_restaurants", args);
          break;
        case "restaurant_details_get":
          result = await callChildMCP(
            "restaurant",
            "get_restaurant_details",
            args
          );
          break;

        // Cart Operations
        case "cart_add_item":
          result = await addToCart(args);
          break;
        case "cart_get":
          result = await getCart(args);
          break;
        case "cart_remove_item":
          result = await removeFromCart(args);
          break;

        // Conversation History
        case "conversation_history_get":
          result = await getConversationHistory(args);
          break;
        case "context_add":
          result = await addContext(args);
          break;

        // Partner Operations
        case "partner_properties_get":
          result = await callChildMCP(
            "partner",
            "get_partner_properties",
            args
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
      console.error(`Error executing tool ${name}:`, error);
      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32000, message: error.message },
      });
    }
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Call child MCP server
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
    console.error(`Error calling ${mcpName} MCP:`, error.message);
    throw new Error(`Failed to call ${mcpName} service: ${error.message}`);
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function createSession({ client_id, domain }) {
  try {
    // Validate client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      throw new Error("Client not found");
    }

    // Create session
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        session_id: generateSessionId(),
        client_id: client_id,
        status: "active",
        expires_at: expires_at.toISOString(),
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error("Session creation error:", sessionError);
      throw new Error("Failed to create session");
    }

    return {
      success: true,
      session_id: session.session_id,
      client_id: client.id,
      client_config: {
        name: client.name,
        primary_color: client.primary_color,
        secondary_color: client.secondary_color,
        enabled_services: client.enabled_services,
      },
      expires_at: session.expires_at,
    };
  } catch (error) {
    console.error("Create session error:", error);
    return { success: false, error: error.message };
  }
}

async function getSession({ session_id }) {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        clients (
          id,
          name,
          primary_color,
          secondary_color,
          enabled_services
        )
      `
      )
      .eq("session_id", session_id)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Session not found",
      };
    }

    return {
      success: true,
      session_id: data.session_id,
      client_id: data.client_id,
      user_id: data.user_id,
      status: data.status,
      created_at: data.created_at,
      expires_at: data.expires_at,
      client_config: data.clients
        ? {
            name: data.clients.name,
            primary_color: data.clients.primary_color,
            secondary_color: data.clients.secondary_color,
            enabled_services: data.clients.enabled_services,
          }
        : null,
    };
  } catch (err) {
    console.error("Get session error:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// CONVERSATION HISTORY
// ============================================

async function getConversationHistory({ session_id, limit = 20 }) {
  try {
    const { data, error } = await supabase
      .from("conversation_history")
      .select("*")
      .eq("session_id", session_id)
      .order("turn_number", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Get history error:", error);
      return { success: false, error: error.message, messages: [] };
    }

    // Reverse to get chronological order (oldest first)
    const messages = (data || []).reverse().map((msg) => {
      const isUser = msg.user_message !== null;
      return {
        role: isUser ? "user" : "assistant",
        content: isUser ? msg.user_message : msg.assistant_message,
        turn_number: msg.turn_number,
        timestamp: msg.created_at,
      };
    });

    return {
      success: true,
      session_id: session_id,
      messages: messages,
      count: messages.length,
    };
  } catch (err) {
    console.error("Get history error:", err);
    return { success: false, error: err.message, messages: [] };
  }
}

async function addContext({ session_id, role, content }) {
  try {
    // Verify session exists
    const { data: sessionCheck } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_id", session_id)
      .single();

    if (!sessionCheck) {
      return { success: false, error: "Session not found" };
    }

    // Get current turn number
    const { data: lastTurn } = await supabase
      .from("conversation_history")
      .select("turn_number")
      .eq("session_id", session_id)
      .order("turn_number", { ascending: false })
      .limit(1)
      .single();

    const nextTurn = (lastTurn?.turn_number || 0) + 1;

    // Prepare insert data
    const insertData = {
      session_id: sessionCheck.id,
      turn_number: nextTurn,
      created_at: new Date().toISOString(),
    };

    // Add message based on role
    if (role === "user") {
      insertData.user_message = content;
      insertData.assistant_message = null;
    } else {
      insertData.user_message = null;
      insertData.assistant_message = content;
    }

    const { data, error } = await supabase
      .from("conversation_history")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Add context error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message_id: data.id,
      session_id: session_id,
      turn_number: nextTurn,
      role: role,
    };
  } catch (err) {
    console.error("Add context error:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// CART OPERATIONS
// ============================================

async function addToCart({ session_id, item }) {
  try {
    // Get session internal ID
    const { data: session } = await supabase
      .from("sessions")
      .select("id, client_id")
      .eq("session_id", session_id)
      .single();

    if (!session) {
      throw new Error("Session not found");
    }

    // Check if cart exists
    const { data: existingCarts, error: cartFetchError } = await supabase
      .from("carts")
      .select("*")
      .eq("session_id", session.id)
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
          session_id: session.id,
          client_id: session.client_id,
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
    const { data: cartItem, error: itemInsertError } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cart.cart_id,
        property_id: item.property_id,
        property_type: item.property_type,
        is_partner: item.is_partner || false,
        service_details: item.service_details,
        unit_price: item.unit_price,
        quantity: item.quantity || 1,
        total_price: item.total_price,
        currency: item.currency || "AED",
      })
      .select()
      .single();

    if (itemInsertError) {
      console.error("Cart item insertion error:", itemInsertError);
      throw new Error(`Failed to add item to cart: ${itemInsertError.message}`);
    }

    return {
      success: true,
      cart_id: cart.cart_id,
      item_id: cartItem.cart_item_id,
      message: "Item added to cart successfully",
    };
  } catch (error) {
    console.error("Add to cart error:", error);
    return { success: false, error: error.message };
  }
}

async function getCart({ session_id }) {
  try {
    // Get session internal ID
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_id", session_id)
      .single();

    if (!session) {
      return { success: true, cart_items: [] };
    }

    const { data: carts, error } = await supabase
      .from("carts")
      .select(
        `
        *,
        cart_items (*)
      `
      )
      .eq("session_id", session.id)
      .eq("status", "active");

    if (error) {
      console.error("Get cart error:", error);
      return { success: true, cart_items: [] };
    }

    if (!carts || carts.length === 0) {
      return { success: true, cart_items: [] };
    }

    return {
      success: true,
      cart_id: carts[0].cart_id,
      cart_items: carts[0].cart_items || [],
      total_items: (carts[0].cart_items || []).length,
      expires_at: carts[0].expires_at,
    };
  } catch (error) {
    console.error("Get cart error:", error);
    return { success: true, cart_items: [] };
  }
}

async function removeFromCart({ session_id, item_id }) {
  try {
    // Get session internal ID
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_id", session_id)
      .single();

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Get cart
    const { data: carts } = await supabase
      .from("carts")
      .select("cart_id")
      .eq("session_id", session.id)
      .eq("status", "active")
      .single();

    if (!carts) {
      return { success: false, error: "Cart not found" };
    }

    // Delete item
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", carts.cart_id)
      .eq("cart_item_id", item_id);

    if (error) {
      console.error("Remove from cart error:", error);
      return { success: false, error: error.message };
    }

    // Get updated cart
    const updatedCart = await getCart({ session_id });

    return {
      success: true,
      removed_item_id: item_id,
      cart: updatedCart,
    };
  } catch (err) {
    console.error("Remove from cart error:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "orchestrator-mcp",
    timestamp: new Date().toISOString(),
    childMCPs: Object.keys(childMCPs),
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🎯 Orchestrator MCP Server running on http://localhost:${PORT}`);
  console.log(`📡 Connected to ${Object.keys(childMCPs).length} child MCPs`);
});
