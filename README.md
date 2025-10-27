# White-Label AI Hospitality Assistant - MCP Servers
## Data Layer - Phase 1

Complete MCP server implementation for the hospitality booking platform.

## 🏗️ Architecture

```
Orchestrator MCP (Port 3000)
    ├── Hotel MCP (Port 3001)
    ├── Restaurant MCP (Port 3002)
    ├── User MCP (Port 3003)
    └── Partner MCP (Port 3004)
```

## 📦 What's Included

- **5 MCP Servers** (Orchestrator + 4 child MCPs)
- **100 Mock Properties** (50 hotels + 50 restaurants)
- **5 Cities** (Dubai, London, New York, Singapore, New Delhi)
- **Supabase Integration** (Platform data storage)
- **MCP Protocol** (JSON-RPC 2.0 over HTTP)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Start All MCP Servers

```bash
npm run start:all
```

Or start individually:
```bash
npm run start:orchestrator  # Port 3000
npm run start:hotel        # Port 3001
npm run start:restaurant   # Port 3002
npm run start:user         # Port 3003
npm run start:partner      # Port 3004
```

### 4. Test the Setup

```bash
npm run test
```

## 🗂️ Project Structure

```
/hospitality-mcp-servers/
├── mock-data/              # JSON mock data
│   ├── hotels/            # 50 hotels across 5 cities
│   └── restaurants/       # 50 restaurants across 5 cities
├── src/
│   ├── orchestrator-mcp/  # Central coordinator
│   ├── hotel-mcp/         # Hotel operations
│   ├── restaurant-mcp/    # Restaurant operations
│   ├── user-mcp/          # User management
│   └── partner-mcp/       # Partner recommendations
├── config/                # Configuration files
└── scripts/               # Deployment scripts
```

## 🔧 Configuration

### Environment Variables (.env)

```
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# MCP Servers
ORCHESTRATOR_PORT=3000
HOTEL_MCP_PORT=3001
RESTAURANT_MCP_PORT=3002
USER_MCP_PORT=3003
PARTNER_MCP_PORT=3004

# MCP API Keys
ORCHESTRATOR_API_KEY=your_orchestrator_api_key
HOTEL_MCP_API_KEY=your_hotel_mcp_api_key
RESTAURANT_MCP_API_KEY=your_restaurant_mcp_api_key
USER_MCP_API_KEY=your_user_mcp_api_key
PARTNER_MCP_API_KEY=your_partner_mcp_api_key

# Environment
NODE_ENV=development
```

## 📡 API Endpoints

### Orchestrator MCP (Port 3000)

All requests go through the Orchestrator:

```
POST /mcp - Main MCP endpoint (JSON-RPC 2.0)
GET /health - Health check
```

### Available Tools

**Session Management:**
- `session_create`
- `session_validate`
- `session_identify`
- `session_get_history`

**Cart Operations:**
- `cart_add_item`
- `cart_remove_item`
- `cart_get`
- `cart_clear`

**Booking:**
- `booking_create`
- `booking_confirm`
- `booking_cancel`

**Property Search:**
- `search_hotels`
- `search_restaurants`

## 🧪 Testing

### Manual Testing

```bash
# Test Orchestrator MCP
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "search_hotels",
      "arguments": {
        "client_id": "test_client",
        "location": "Dubai",
        "check_in": "2025-12-01",
        "check_out": "2025-12-03",
        "guests": 2
      }
    }
  }'
```

## 📦 Deployment

### Deploy to AWS Lambda

1. **Build for Lambda:**
```bash
npm run build:lambda
```

2. **Deploy:**
```bash
npm run deploy:lambda
```

Deployment script will:
- Create Lambda functions for each MCP
- Set up API Gateway
- Configure environment variables
- Set up VPC (if needed)

### Deploy to EC2

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Clone repository
git clone your-repo-url
cd hospitality-mcp-servers

# Install dependencies
npm install

# Set up PM2
npm install -g pm2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🗃️ Mock Data

### Hotels
- 10 hotels per city (Dubai, London, NYC, Singapore, New Delhi)
- 3 room types per hotel (Standard, Deluxe, Suite)
- Realistic pricing and availability
- Full amenities and descriptions

### Restaurants
- 10 restaurants per city
- 20-30 menu items per restaurant
- Multiple cuisine types
- Table availability schedules

## 🔐 Security

- API key authentication between MCPs
- Supabase Row Level Security (RLS)
- Domain validation for widget embedding
- Multi-tenant data isolation

## 📊 Monitoring

Logs are written to:
- Console (development)
- `logs/` directory (production)

Each MCP logs:
- Incoming requests
- Tool executions
- Errors and warnings
- Performance metrics

## 🐛 Troubleshooting

### MCP Server Won't Start

Check:
1. Port not already in use: `lsof -i :3000`
2. Environment variables configured
3. Supabase credentials valid

### Connection Refused Between MCPs

Check:
1. All MCP servers running
2. Correct ports in config
3. Firewall rules (if deployed)

### Mock Data Not Loading

Check:
1. JSON files in `/mock-data/` directory
2. File paths in MCP server code
3. JSON syntax valid

## 🔄 Development Workflow

1. **Local Development:**
   - Start all MCPs: `npm run start:all`
   - Test with curl or Postman
   - Check logs in console

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Update MCP servers"
   git push origin main
   ```

3. **Deploy to Lambda:**
   ```bash
   npm run deploy:lambda
   ```

## 📚 Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Supabase Docs](https://supabase.com/docs)
- [Architecture Blueprint](./docs/ARCHITECTURE.md)

## 🤝 Contributing

This is a Phase 1 implementation. Future enhancements:
- PMS/POS API integration
- Real-time availability
- Advanced caching
- Load balancing

## 📄 License

Proprietary - White-Label SaaS Product

## 🆘 Support

For issues or questions:
- Check logs in `logs/` directory
- Review Supabase dashboard
- Check MCP server health endpoints

---

**Version:** 1.0.0 (Phase 1)
**Last Updated:** 2025-01-27
