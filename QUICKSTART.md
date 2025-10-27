# Quick Start Guide

## ⚡ Get Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

Get your credentials from: https://app.supabase.com → Project Settings → API

### 3. Start All Servers

```bash
npm run start:all
```

You should see:
```
🎯 Orchestrator MCP Server running on http://localhost:3000
🏨 Hotel MCP Server running on http://localhost:3001
🍽️  Restaurant MCP Server running on http://localhost:3002
👤 User MCP Server running on http://localhost:3003
🤝 Partner MCP Server running on http://localhost:3004
```

### 4. Test the Servers

```bash
# In a new terminal
npm test
```

Expected output:
```
✅ Hotel MCP: healthy
✅ Restaurant MCP: healthy
✅ User MCP: healthy
✅ Partner MCP: healthy
✅ Orchestrator MCP: healthy
```

## 🧪 Manual Testing

### Test Hotel Search

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "search_hotels",
      "arguments": {
        "location": "Dubai",
        "check_in": "2025-12-01",
        "check_out": "2025-12-03",
        "guests": 2,
        "client_id": "test"
      }
    }
  }'
```

### Test Restaurant Search

```bash
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "search_restaurants",
      "arguments": {
        "location": "Dubai",
        "date": "2025-12-01",
        "party_size": 4
      }
    }
  }'
```

## 📊 What's Included

- **50 Hotels** across Dubai, London, New York, Singapore, New Delhi
- **50 Restaurants** across the same 5 cities
- **5 MCP Servers** fully functional
- **Complete mock data** with availability calendars
- **Supabase integration** ready

## 🚀 Next Steps

1. **Push to GitHub**: Follow DEPLOYMENT.md
2. **Deploy to AWS Lambda**: See DEPLOYMENT.md
3. **Integrate with N8N**: Connect workflows to Orchestrator MCP
4. **Build Widget**: Connect frontend to Orchestrator MCP

## 🆘 Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 PID
```

### Supabase Connection Error

- Check SUPABASE_URL is correct
- Verify SUPABASE_SERVICE_KEY (not anon key)
- Ensure Supabase project is active
- Check network/firewall settings

### Mock Data Not Loading

```bash
# Regenerate mock data
node scripts/generate-mock-data.js
```

## 📝 Notes

- All servers run on localhost by default
- Mock data includes 90 days of availability
- In-memory availability resets on server restart (expected for Phase 1)
- Use PM2 for production deployment

## 📚 Documentation

- README.md - Project overview
- PROJECT_SETUP.md - Detailed setup guide
- DEPLOYMENT.md - Deployment instructions
- COMPLETE_IMPLEMENTATION.md - Implementation details

Happy building! 🎉
