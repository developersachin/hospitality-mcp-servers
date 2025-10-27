const express = require("express");
const { supabase } = require("../../config/supabase");
require("dotenv").config({ path: "../../.env" });

const app = express();
const PORT = process.env.USER_MCP_PORT || 3003;

app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { method, params } = req.body;

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          { name: "create_user", description: "Create user profile" },
          { name: "get_user_by_email", description: "Get user by email" },
        ],
      },
    });
  }

  if (method === "tools/call") {
    try {
      const { name, arguments: args } = params;
      let result;

      if (name === "create_user") {
        const { data } = await supabase
          .from("users")
          .insert(args)
          .select()
          .single();
        result = data;
      } else if (name === "get_user_by_email") {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("email", args.email)
          .single();
        result = data;
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

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "user-mcp" });
});

app.listen(PORT, () => {
  console.log(`👤 User MCP Server running on http://localhost:${PORT}`);
});
