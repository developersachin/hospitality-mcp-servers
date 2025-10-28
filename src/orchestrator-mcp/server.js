// orchestrator-mcp/server.js - UPDATED WITH 12 TOOLS
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Child MCP URLs - NOW USING ENV VARS FOR LAMBDA!
const childMCPs = {
  hotel: process.env.HOTEL_MCP_URL || `http://localhost:3001/mcp`,
  restaurant: process.env.RESTAURANT_MCP_URL || `http://localhost:3002/mcp`,
  user: process.env.USER_MCP_URL || `http://localhost:3003/mcp`,
  partner: process.env.PARTNER_MCP_URL || `http://localhost:3004/mcp`,
};

console.log("Child MCP URLs:", childMCPs);

// Helper: Call child MCP server
async function callChildMCP(childName, toolName, args) {
  const childUrl = childMCPs[childName];

  try {
    const response = await fetch(childUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // Extract the actual result from MCP response
    if (data.result?.content?.[0]?.text) {
      return JSON.parse(data.result.content[0].text);
    }

    return data.result;
  } catch (error) {
    console.error(`Error calling ${childName} MCP:`, error);
    throw new Error(`Failed to call ${childName} MCP: ${error.message}`);
  }
}

// ============================================
// SESSION MANAGEMENT FUNCTIONS
// ============================================

async function createSession(args) {
  const { client_id, domain } = args;

  try {
    // Create session in Supabase
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        client_id,
        domain,
        status: "active",
        context: {},
        last_active: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Initialize empty cart for this session
    const { error: cartError } = await supabase.from("carts").insert({
      session_id: session.session_id,
      client_id,
      status: "active",
      cart_items: [],
      total_amount: 0,
      currency: "USD",
    });

    if (cartError) console.error("Cart creation error:", cartError);

    return {
      success: true,
      session_id: session.session_id,
      client_id: session.client_id,
      created_at: session.created_at,
    };
  } catch (err) {
    console.error("Session creation error:", err);
    return { success: false, error: err.message };
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

    if (error) throw error;
    if (!session) throw new Error("Session not found");

    // Update last_active
    await supabase
      .from("sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("session_id", session_id);

    return {
      success: true,
      session,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// CART MANAGEMENT FUNCTIONS
// ============================================

async function addToCart(args) {
  const { session_id, item } = args;

  try {
    // Get current cart
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("*")
      .eq("session_id", session_id)
      .eq("status", "active")
      .single();

    if (cartError) throw cartError;

    // Add new item to cart_items array
    const cartItems = cart.cart_items || [];
    const newItem = {
      cart_item_id: `item_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      ...item,
      added_at: new Date().toISOString(),
    };
    cartItems.push(newItem);

    // Calculate new total
    const newTotal = cartItems.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0
    );

    // Update cart
    const { error: updateError } = await supabase
      .from("carts")
      .update({
        cart_items: cartItems,
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("cart_id", cart.cart_id);

    if (updateError) throw updateError;

    return {
      success: true,
      cart_id: cart.cart_id,
      item_added: newItem,
      total_items: cartItems.length,
      total_amount: newTotal,
    };
  } catch (err) {
    console.error("Add to cart error:", err);
    return { success: false, error: err.message };
  }
}

async function getCart(args) {
  const { session_id } = args;

  try {
    const { data: cart, error } = await supabase
      .from("carts")
      .select("*")
      .eq("session_id", session_id)
      .eq("status", "active")
      .single();

    if (error) throw error;

    return {
      success: true,
      cart_id: cart.cart_id,
      session_id: cart.session_id,
      cart_items: cart.cart_items || [],
      total_amount: cart.total_amount || 0,
      currency: cart.currency || "USD",
      item_count: (cart.cart_items || []).length,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function removeFromCart(args) {
  const { session_id, item_id } = args;

  try {
    // Get current cart
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("*")
      .eq("session_id", session_id)
      .eq("status", "active")
      .single();

    if (cartError) throw cartError;

    // Remove item from cart_items array
    const cartItems = (cart.cart_items || []).filter(
      (item) => item.cart_item_id !== item_id
    );

    // Calculate new total
    const newTotal = cartItems.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0
    );

    // Update cart
    const { error: updateError } = await supabase
      .from("carts")
      .update({
        cart_items: cartItems,
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("cart_id", cart.cart_id);

    if (updateError) throw updateError;

    return {
      success: true,
      removed_item_id: item_id,
      remaining_items: cartItems.length,
      total_amount: newTotal,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// CONVERSATION CONTEXT FUNCTIONS
// ============================================

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

    if (error) throw error;

    return {
      success: true,
      context_id: context.context_id,
      message_saved: true,
    };
  } catch (err) {
    return { success: false, error: err.message };
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

    if (error) throw error;

    return {
      success: true,
      session_id,
      message_count: history.length,
      messages: history.reverse(), // Return in chronological order
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// MCP SERVER ROUTES
// ============================================

app.post("/mcp", async (req, res) => {
  const { method, params } = req.body;

  // TOOLS/LIST - Return all 12 available tools
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          {
            name: "session_create",
            description: "Create new user session",
            inputSchema: {
              type: "object",
              properties: {
                client_id: { type: "string" },
                domain: { type: "string" },
              },
              required: ["client_id", "domain"],
            },
          },
          {
            name: "session_get",
            description: "Get existing session details",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
              },
              required: ["session_id"],
            },
          },
          {
            name: "search_hotels",
            description: "Search for hotels via Hotel MCP",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
                check_in_date: { type: "string" },
                check_out_date: { type: "string" },
                guests: { type: "number" },
              },
              required: ["location"],
            },
          },
          {
            name: "hotel_details_get",
            description: "Get detailed hotel information including rooms",
            inputSchema: {
              type: "object",
              properties: {
                hotel_id: { type: "string" },
                check_in_date: { type: "string" },
                check_out_date: { type: "string" },
                guests: { type: "number" },
              },
              required: ["hotel_id"],
            },
          },
          {
            name: "search_restaurants",
            description: "Search for restaurants via Restaurant MCP",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
                date: { type: "string" },
                time: { type: "string" },
                guests: { type: "number" },
              },
              required: ["location"],
            },
          },
          {
            name: "restaurant_details_get",
            description: "Get detailed restaurant information including menu",
            inputSchema: {
              type: "object",
              properties: {
                restaurant_id: { type: "string" },
                date: { type: "string" },
                time: { type: "string" },
                guests: { type: "number" },
              },
              required: ["restaurant_id"],
            },
          },
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
            description: "Get shopping cart contents",
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
            description: "Remove item from shopping cart",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                item_id: { type: "string" },
              },
              required: ["session_id", "item_id"],
            },
          },
          {
            name: "conversation_history_get",
            description: "Get conversation history for a session",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                limit: { type: "number" },
              },
              required: ["session_id"],
            },
          },
          {
            name: "context_add",
            description: "Add message to conversation context",
            inputSchema: {
              type: "object",
              properties: {
                session_id: { type: "string" },
                role: { type: "string" },
                content: { type: "string" },
                intent: { type: "string" },
                entities: { type: "object" },
              },
              required: ["session_id", "role", "content"],
            },
          },
          {
            name: "partner_properties_get",
            description: "Get partner property recommendations",
            inputSchema: {
              type: "object",
              properties: {
                location: { type: "string" },
                property_type: { type: "string" },
                check_in_date: { type: "string" },
                check_out_date: { type: "string" },
                guests: { type: "number" },
              },
              required: ["location", "property_type"],
            },
          },
        ],
      },
    });
  }

  // TOOLS/CALL - Execute tool
  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      let result;

      // Session Management
      if (name === "session_create") {
        result = await createSession(args);
      } else if (name === "session_get") {
        result = await getSession(args);
      }
      // Hotel Services (delegate to Hotel MCP)
      else if (name === "search_hotels") {
        result = await callChildMCP("hotel", "search_hotels", args);
      } else if (name === "hotel_details_get") {
        result = await callChildMCP("hotel", "get_hotel_details", args);
      }
      // Restaurant Services (delegate to Restaurant MCP)
      else if (name === "search_restaurants") {
        result = await callChildMCP("restaurant", "search_restaurants", args);
      } else if (name === "restaurant_details_get") {
        result = await callChildMCP(
          "restaurant",
          "get_restaurant_details",
          args
        );
      }
      // Cart Management
      else if (name === "cart_add_item") {
        result = await addToCart(args);
      } else if (name === "cart_get") {
        result = await getCart(args);
      } else if (name === "cart_remove_item") {
        result = await removeFromCart(args);
      }
      // Conversation Context
      else if (name === "conversation_history_get") {
        result = await getConversationHistory(args);
      } else if (name === "context_add") {
        result = await addContext(args);
      }
      // Partner Services (delegate to Partner MCP)
      else if (name === "partner_properties_get") {
        result = await callChildMCP("partner", "get_partner_properties", args);
      }
      // Unknown tool
      else {
        throw new Error(`Unknown tool: ${name}`);
      }

      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        },
      });
    } catch (error) {
      console.error(`Tool execution error (${name}):`, error);
      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: {
          code: -32000,
          message: error.message,
        },
      });
    }
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "orchestrator-mcp",
    tools: 12,
    timestamp: new Date().toISOString(),
  });
});

// Export for Lambda
module.exports.handler = async (event, context) => {
  // Convert API Gateway event to Express-like request
  const request = {
    body: JSON.parse(event.body || "{}"),
    headers: event.headers,
    method: event.httpMethod,
    path: event.path,
  };

  // Create response object
  let response = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: "",
  };

  // Handle the request
  if (request.path === "/health") {
    response.body = JSON.stringify({
      status: "healthy",
      service: "orchestrator-mcp",
      tools: 12,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Handle MCP request
    const { method, params } = request.body;

    if (method === "tools/list") {
      response.body = JSON.stringify({
        jsonrpc: "2.0",
        id: request.body.id,
        result: {
          tools: [
            { name: "session_create", description: "Create new user session" },
            {
              name: "session_get",
              description: "Get existing session details",
            },
            {
              name: "search_hotels",
              description: "Search for hotels via Hotel MCP",
            },
            {
              name: "hotel_details_get",
              description: "Get detailed hotel information",
            },
            {
              name: "search_restaurants",
              description: "Search for restaurants via Restaurant MCP",
            },
            {
              name: "restaurant_details_get",
              description: "Get detailed restaurant information",
            },
            { name: "cart_add_item", description: "Add item to shopping cart" },
            { name: "cart_get", description: "Get shopping cart contents" },
            {
              name: "cart_remove_item",
              description: "Remove item from shopping cart",
            },
            {
              name: "conversation_history_get",
              description: "Get conversation history",
            },
            {
              name: "context_add",
              description: "Add message to conversation context",
            },
            {
              name: "partner_properties_get",
              description: "Get partner property recommendations",
            },
          ],
        },
      });
    } else if (method === "tools/call") {
      const { name, arguments: args } = params;

      try {
        let result;

        // Session Management
        if (name === "session_create") {
          result = await createSession(args);
        } else if (name === "session_get") {
          result = await getSession(args);
        }
        // Hotel Services
        else if (name === "search_hotels") {
          result = await callChildMCP("hotel", "search_hotels", args);
        } else if (name === "hotel_details_get") {
          result = await callChildMCP("hotel", "get_hotel_details", args);
        }
        // Restaurant Services
        else if (name === "search_restaurants") {
          result = await callChildMCP("restaurant", "search_restaurants", args);
        } else if (name === "restaurant_details_get") {
          result = await callChildMCP(
            "restaurant",
            "get_restaurant_details",
            args
          );
        }
        // Cart Management
        else if (name === "cart_add_item") {
          result = await addToCart(args);
        } else if (name === "cart_get") {
          result = await getCart(args);
        } else if (name === "cart_remove_item") {
          result = await removeFromCart(args);
        }
        // Conversation Context
        else if (name === "conversation_history_get") {
          result = await getConversationHistory(args);
        } else if (name === "context_add") {
          result = await addContext(args);
        }
        // Partner Services
        else if (name === "partner_properties_get") {
          result = await callChildMCP(
            "partner",
            "get_partner_properties",
            args
          );
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }

        response.body = JSON.stringify({
          jsonrpc: "2.0",
          id: request.body.id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result) }],
          },
        });
      } catch (error) {
        response.statusCode = 500;
        response.body = JSON.stringify({
          jsonrpc: "2.0",
          id: request.body.id,
          error: { code: -32000, message: error.message },
        });
      }
    }
  }

  return response;
};

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Orchestrator MCP running on port ${PORT}`);
    console.log(`📊 Available tools: 12`);
    console.log(`🔗 Child MCPs:`, childMCPs);
  });
}
