#!/bin/bash

# Ultimate Cursor MCP GitHub Installer
# This script installs the Ultimate Cursor MCP directly from GitHub without using Smithery

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Ultimate Cursor MCP - GitHub Direct Installer${NC}"
echo -e "---------------------------------------------"

# Set default repository values
REPO_USER="giorgos3215"
REPO_NAME="ultimate-cursor-mcp"
BRANCH="main"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed. Please install git and try again.${NC}"
    exit 1
fi

# Ask for the target directory or use default
echo -e "${YELLOW}Where would you like to install the MCP?${NC}"
read -p "Target directory [~/ultimate-cursor-mcp]: " TARGET_DIR
TARGET_DIR=${TARGET_DIR:-~/ultimate-cursor-mcp}
TARGET_DIR=$(eval echo "$TARGET_DIR") # Expand ~ and other shell expressions

# Clone the repository
echo -e "\n${BLUE}Cloning repository from GitHub...${NC}"
if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}Directory already exists. Updating...${NC}"
    cd "$TARGET_DIR" && git pull origin $BRANCH
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to update repository. Please check your internet connection and try again.${NC}"
        exit 1
    fi
else
    git clone "https://github.com/$REPO_USER/$REPO_NAME.git" "$TARGET_DIR"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to clone repository. Please check your internet connection and try again.${NC}"
        exit 1
    fi
    cd "$TARGET_DIR"
fi

# Install dependencies
echo -e "\n${BLUE}Installing dependencies...${NC}"
if command -v npm &> /dev/null; then
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install npm dependencies. Please check your npm installation and try again.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: npm is not installed. Please install Node.js and npm and try again.${NC}"
    exit 1
fi

# Make scripts executable
echo -e "\n${BLUE}Making scripts executable...${NC}"
chmod +x src/cursor-mcp-wrapper.js
chmod +x src/enhanced-mcp.js

# Update Cursor configuration
echo -e "\n${BLUE}Updating Cursor MCP configuration...${NC}"
# Define the configuration path
CONFIG_PATH="$HOME/.cursor/mcp.json"
CACHE_DIR="$HOME/.cursor/cache/ultimate-cursor-mcp"

# Create necessary directories if they don't exist
mkdir -p "$(dirname "$CONFIG_PATH")"
mkdir -p "$CACHE_DIR"

# Create MCP config file with proper formatting
cat > "$CONFIG_PATH" << EOL
{
  "mcpServers": {
    "ultimate-cursor-mcp": {
      "command": "node",
      "args": ["$TARGET_DIR/src/cursor-mcp-wrapper.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_SERVER_SCRIPT": "$TARGET_DIR/src/enhanced-mcp.js",
        "MCP_LOG_LEVEL": "info",
        "MCP_MEMORY_FILE": "$TARGET_DIR/memory.json",
        "MCP_RULES_FILE": "$TARGET_DIR/.cursorrules"
      },
      "cacheDirectoryPath": "$CACHE_DIR",
      "cwd": "$TARGET_DIR",
      "capabilities": {
        "tools": true,
        "restart": true
      },
      "maxStreamingResponseTokens": 100000,
      "description": "Ultimate Self-Evolving Cursor MCP with enhanced web, code, database, file, and AI capabilities."
    }
  }
}
EOL

# Check for optional Supabase integration
echo -e "\n${YELLOW}Would you like to set up Supabase integration? (y/n)${NC}"
read -p "> " setup_supabase

if [[ "$setup_supabase" =~ ^[Yy]$ ]]; then
    echo -e "\n${BLUE}Setting up Supabase integration...${NC}"
    echo -e "${YELLOW}Enter your Supabase project URL:${NC}"
    read -p "> " supabase_url
    
    echo -e "${YELLOW}Enter your Supabase API key (service_role key recommended):${NC}"
    read -s -p "> " supabase_key
    echo ""
    
    echo -e "${YELLOW}Optional: Enter a project reference name (e.g., 'my-project'):${NC}"
    read -p "> " supabase_ref
    
    # Update the MCP config with Supabase credentials
    if command -v jq &> /dev/null; then
        tmp=$(mktemp)
        jq --arg url "$supabase_url" --arg key "$supabase_key" '.mcpServers."ultimate-cursor-mcp".env.SUPABASE_URL = $url | .mcpServers."ultimate-cursor-mcp".env.SUPABASE_API_KEY = $key' "$CONFIG_PATH" > "$tmp" && mv "$tmp" "$CONFIG_PATH"
    else
        # Fallback if jq is not available
        sed -i'' -e "s|\"MCP_RULES_FILE\": \".*\"|\"MCP_RULES_FILE\": \"$TARGET_DIR/.cursorrules\",\n        \"SUPABASE_URL\": \"$supabase_url\",\n        \"SUPABASE_API_KEY\": \"$supabase_key\"|g" "$CONFIG_PATH"
    fi
    
    echo -e "${GREEN}Supabase integration set up successfully!${NC}"
fi

# Create a test script to verify installation
echo -e "\n${BLUE}Creating test script...${NC}"
cat > "$TARGET_DIR/test-mcp.sh" << EOL
#!/bin/bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "mcp.ListTools"}' | node src/cursor-mcp-wrapper.js
EOL
chmod +x "$TARGET_DIR/test-mcp.sh"

echo -e "\n${GREEN}Ultimate Cursor MCP has been installed successfully!${NC}"
echo -e "Installation path: ${BLUE}$TARGET_DIR${NC}"
echo -e "Configuration: ${BLUE}$CONFIG_PATH${NC}"

echo -e "\n${YELLOW}To test the MCP, run:${NC}"
echo -e "  cd $TARGET_DIR && ./test-mcp.sh"

echo -e "\n${YELLOW}⚠️ Important:${NC} Please restart Cursor for the changes to take effect." 