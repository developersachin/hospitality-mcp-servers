const express = require("express");
const { supabase } = require("../../config/supabase");
require("dotenv").config({ path: "../../.env" });

const app = express();
const PORT = process.env.PARTNER_MCP_PORT || 3004;

app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { method, params } = req.body;

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        tools: [
          {
            name: "get_partner_properties",
            description: "Get partner properties for client",
          },
        ],
      },
    });
  }

  if (method === "tools/call") {
    try {
      const { name, arguments: args } = params;
      let result = { partners: [] };

      if (name === "get_partner_properties") {
        const { data } = await supabase
          .from("partner_relationships")
          .select("*")
          .eq("client_id", args.client_id)
          .eq("is_active", true);
        result = { partners: data || [] };
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
  res.json({ status: "healthy", service: "partner-mcp" });
});

app.listen(PORT, () => {
  console.log(`🤝 Partner MCP Server running on http://localhost:${PORT}`);
});
