# Ultimate Cursor MCP - GitHub Installation Guide

This guide shows how to install the Ultimate Self-Evolving Cursor MCP directly from GitHub and configure it to work with Cursor.

## Prerequisites

- [Git](https://git-scm.com/)
- [Node.js and npm](https://nodejs.org/) (v14 or newer)
- [Cursor IDE](https://cursor.sh/)

## Installation Options

### Option 1: Using the Installation Script (Recommended)

1. Download the installation script:
   ```bash
   curl -o github_install.sh https://raw.githubusercontent.com/giorgos3215/ultimate-cursor-mcp/main/github_install.sh
   ```

2. Make it executable:
   ```bash
   chmod +x github_install.sh
   ```

3. Run the script:
   ```bash
   ./github_install.sh
   ```

4. Follow the prompts to complete the installation.

5. Restart Cursor for the changes to take effect.

### Option 2: Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/giorgos3215/ultimate-cursor-mcp.git ~/ultimate-cursor-mcp
   ```

2. Change to the repository directory:
   ```bash
   cd ~/ultimate-cursor-mcp
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Make scripts executable:
   ```bash
   chmod +x src/cursor-mcp-wrapper.js
   chmod +x src/enhanced-mcp.js
   ```

5. Create the Cursor MCP configuration:
   ```bash
   mkdir -p ~/.cursor
   cat > ~/.cursor/mcp.json << EOL
   {
     "mcpServers": {
       "ultimate-cursor-mcp": {
         "command": "node",
         "args": ["$HOME/ultimate-cursor-mcp/src/cursor-mcp-wrapper.js"],
         "env": {
           "NODE_ENV": "production",
           "MCP_SERVER_SCRIPT": "$HOME/ultimate-cursor-mcp/src/enhanced-mcp.js",
           "MCP_LOG_LEVEL": "info",
           "MCP_MEMORY_FILE": "$HOME/ultimate-cursor-mcp/memory.json",
           "MCP_RULES_FILE": "$HOME/ultimate-cursor-mcp/.cursorrules"
         },
         "cacheDirectoryPath": "$HOME/.cursor/cache/ultimate-cursor-mcp",
         "cwd": "$HOME/ultimate-cursor-mcp",
         "capabilities": {
           "tools": true,
           "restart": true
         },
         "maxStreamingResponseTokens": 100000,
         "description": "Ultimate Self-Evolving Cursor MCP with enhanced capabilities."
       }
     }
   }
   EOL
   ```

6. Create the cache directory:
   ```bash
   mkdir -p ~/.cursor/cache/ultimate-cursor-mcp
   ```

7. Restart Cursor for the changes to take effect.

## Testing Your Installation

To verify that the MCP is working correctly:

```bash
cd ~/ultimate-cursor-mcp
echo '{"jsonrpc": "2.0", "id": 1, "method": "mcp.ListTools"}' | node src/cursor-mcp-wrapper.js
```

You should see a JSON response listing all available tools.

## Optional: Supabase Integration

If you want to use Supabase with the MCP:

1. Get your Supabase project URL and API key (service_role key recommended).

2. Update your MCP configuration:
   ```bash
   # Using jq (recommended)
   jq '.mcpServers."ultimate-cursor-mcp".env.SUPABASE_URL = "your-project-url" | .mcpServers."ultimate-cursor-mcp".env.SUPABASE_API_KEY = "your-api-key"' ~/.cursor/mcp.json > tmp.json && mv tmp.json ~/.cursor/mcp.json

   # OR manually edit the file:
   nano ~/.cursor/mcp.json
   ```

3. Restart Cursor for the changes to take effect.

## Troubleshooting

### MCP not showing up in Cursor

- Make sure the configuration file is correctly placed at `~/.cursor/mcp.json`
- Verify that the paths in the configuration file match your actual installation
- Restart Cursor completely

### JSON-RPC errors

- Check the logs at `~/ultimate-cursor-mcp/mcp-cursor.log`
- Make sure all the JavaScript files have execute permission
- Verify that all dependencies are installed correctly

## Updating

To update to the latest version:

```bash
cd ~/ultimate-cursor-mcp
git pull
npm install
```

Then restart Cursor for the changes to take effect. 