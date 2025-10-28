const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.get('*/health', (req, res) => {
  res.json({ status: 'healthy', service: 'partner-mcp-lambda' });
});

app.post('*/mcp', async (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [{ name: 'get_partner_properties', description: 'Get partner properties' }] }
    });
  }
  if (method === 'tools/call') {
    try {
      const { name, arguments: args } = params;
      if (name === 'get_partner_properties') {
        const { data } = await supabase
          .from('partner_relationships')
          .select('*')
          .eq('client_id', args.client_id)
          .eq('is_active', true);
        const result = { partners: data || [] };
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
        });
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
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
