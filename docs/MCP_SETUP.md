# MCP Server Configuration for Otakudesu API

## Overview
MCP (Model Context Protocol) servers enable AI agents to interact with external services like GitHub, Railway, and databases.

## Configuration Files

### 1. GitHub MCP Server
Location: `~/.gemini/mcp-servers/github.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### 2. Railway MCP Server (Custom)
Railway tidak memiliki MCP server resmi, tapi bisa menggunakan REST API:

```json
{
  "mcpServers": {
    "railway": {
      "command": "node",
      "args": ["railway-mcp-server.js"],
      "env": {
        "RAILWAY_API_TOKEN": "YOUR_RAILWAY_TOKEN"
      }
    }
  }
}
```

## Setup Instructions

### Step 1: Generate GitHub Token
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`, `write:packages`
4. Copy the token

### Step 2: Generate Railway Token
1. Go to https://railway.app/account/tokens
2. Create new token
3. Copy the token

### Step 3: Create MCP Config
Create file at: `C:\Users\Reno Rendo\.gemini\mcp.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

### Step 4: Restart VS Code
After configuring, restart VS Code/Cursor for changes to take effect.

## Alternative: Manual Git Commands

If MCP is not available, use git commands directly:

```bash
# Initialize git
git init
git remote add origin https://github.com/YOUR_USERNAME/otakudesu-api.git

# Commit and push
git add .
git commit -m "Initial commit: Otakudesu API Scraper"
git push -u origin main
```

## Alternative: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```
