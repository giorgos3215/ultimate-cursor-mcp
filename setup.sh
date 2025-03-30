#!/bin/bash

echo "=========================================="
echo "Ultimate Cursor MCP + Supabase Setup"
echo "=========================================="
echo ""

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo "Checking dependencies..."
if ! command_exists python3; then
  echo "Error: Python 3 is required but not installed."
  exit 1
fi

if ! command_exists node; then
  echo "Warning: Node.js is not installed. It may be required for some MCP servers."
fi

if ! command_exists npm; then
  echo "Warning: npm is not installed. It may be required for some MCP servers."
fi

# Install/update Ultimate Cursor MCP
echo ""
echo "Setting up Ultimate Cursor MCP..."
python3 tools/mcp_installer.py local . || {
  echo "Error: Failed to install Ultimate Cursor MCP."
  exit 1
}

# Ask if user wants to install Supabase MCP
echo ""
echo "Would you like to set up the Supabase MCP? (y/n)"
read -r install_supabase

if [[ "$install_supabase" == "y" || "$install_supabase" == "Y" ]]; then
  echo ""
  echo "Please provide your Supabase project information:"
  
  # Collect Supabase details
  echo "Supabase Project URL (e.g., https://yourproject.supabase.co):"
  read -r supabase_url
  
  echo "Supabase API Key (service_role key recommended for full access):"
  read -rs supabase_key
  echo ""
  
  # Optional project ref
  echo "Supabase Project Reference (optional, press Enter to skip):"
  read -r supabase_ref
  
  # Install Supabase MCP
  echo ""
  echo "Installing Supabase MCP..."
  
  if [[ -n "$supabase_ref" ]]; then
    python3 tools/mcp_installer.py supabase --url "$supabase_url" --key "$supabase_key" --ref "$supabase_ref" || {
      echo "Error: Failed to install Supabase MCP."
      exit 1
    }
  else
    python3 tools/mcp_installer.py supabase --url "$supabase_url" --key "$supabase_key" || {
      echo "Error: Failed to install Supabase MCP."
      exit 1
    }
  fi
fi

echo ""
echo "=========================================="
echo "Setup completed successfully!"
echo "Please restart Cursor for the changes to take effect."
echo "==========================================" 