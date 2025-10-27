# Deployment Guide

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start all servers
npm run start:all

# 4. Test
npm test
```

## GitHub Deployment

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit: MCP servers"

# Create GitHub repository and push
git remote add origin https://github.com/yourusername/hospitality-mcp-servers.git
git branch -M main
git push -u origin main
```

## AWS Lambda Deployment

### Prerequisites
- AWS CLI configured
- IAM role with Lambda execution permissions
- Supabase database accessible from AWS

### Deploy Script

```bash
# Package for Lambda
npm run build:lambda

# Deploy to AWS
aws lambda create-function \
  --function-name orchestrator-mcp \
  --runtime nodejs18.x \
  --handler server.handler \
  --zip-file fileb://dist/orchestrator-mcp.zip \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --environment Variables="{SUPABASE_URL=...,SUPABASE_KEY=...}"

# Repeat for each MCP server
```

### Environment Variables

Set in Lambda console:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY  
- HOTEL_MCP_PORT (Lambda will override)
- Other API keys

## EC2 Deployment

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-instance

# Clone repository
git clone your-repo-url
cd hospitality-mcp-servers

# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Start all servers
pm2 start ecosystem.config.js

# Save configuration
pm2 save
pm2 startup
```

## Monitoring

- Logs: `pm2 logs`
- Status: `pm2 status`
- Restart: `pm2 restart all`

## Security Checklist

- [ ] Environment variables configured
- [ ] Supabase RLS policies enabled
- [ ] API keys rotated from defaults
- [ ] HTTPS/SSL configured
- [ ] Rate limiting enabled
- [ ] Firewall rules configured
- [ ] Domain validation active

