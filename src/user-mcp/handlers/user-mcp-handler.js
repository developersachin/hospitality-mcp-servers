const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-mcp-lambda' });
});

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: { tools: [
        { name: 'create_user', description: 'Create user' },
        { name: 'get_user_by_email', description: 'Get user' }
      ]}
    });
  }
  if (method === 'tools/call') {
    try {
      const { name, arguments: args } = params;
      let result;
      if (name === 'create_user') {
        const { data } = await supabase.from('users').insert(args).select().single();
        result = data;
      } else {
        const { data } = await supabase.from('users').select('*').eq('email', args.email).single();
        result = data;
      }
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      });
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
