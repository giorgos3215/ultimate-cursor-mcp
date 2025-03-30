# Ultimate Self-Evolving Cursor MCP

A comprehensive MCP (Model Context Protocol) implementation for Cursor, featuring advanced tools for web, code, file operations, and Supabase database management.

[![Smithery.ai](https://img.shields.io/badge/Smithery.ai-Available-blue.svg)](https://smithery.ai/package/ultimate-cursor-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Advanced web tools (scraping, crawling, semantic search)
- Powerful code analysis and refactoring tools
- File operations with batch processing and watching capabilities
- AI-powered capabilities (LLM queries, image analysis)
- **Full Supabase integration** for database operations and management
- Self-improvement mechanism with usage analytics
- Memory persistence for better context understanding

## Installation

### Easy Setup (Recommended)

Run the setup script which will install both the Ultimate Cursor MCP and optionally the Supabase MCP:

```bash
./setup.sh
```

The script will:
1. Install the Ultimate Cursor MCP
2. Ask if you want to set up Supabase integration
3. Guide you through providing Supabase credentials if needed
4. Configure everything automatically

### Manual Installation

#### Ultimate Cursor MCP

```bash
python3 tools/mcp_installer.py local .
```

#### Supabase MCP (Optional)

```bash
python3 tools/mcp_installer.py supabase --url "https://yourproject.supabase.co" --key "your-api-key"
```

### Smithery.ai Installation

If you prefer to install via smithery.ai:

```bash
cursor smithery install ultimate-cursor-mcp
```

## Supabase Integration

The Supabase integration provides:

- SQL query execution with safety controls (read-only by default)
- Database schema inspection tools
- Management API access with safety classifications
- Auth Admin tools for user management

### Benefits of Supabase MCP

- **Safety features**: Starts in read-only mode; requires explicit mode switching for write operations
- **Comprehensive database tools**: Schema inspection, table information, detailed structure
- **Full SQL support**: Execute any PostgreSQL query with transaction handling
- **Advanced Management API access**: Send arbitrary requests with auto-injection of project ref
- **Auth Admin tools**: User creation, deletion, invitation and management

[Read the complete Supabase integration guide](./docs/supabase.md)

## Testing

After installation, you can test the functionality:

```bash
./test-client.js
```

## Configuration

The configuration is stored in `~/.cursor/mcp.json`. After installation, restart Cursor for the changes to take effect.

## Development

### Project Structure

- `src/` - TypeScript implementation of the MCP server
  - `enhanced-mcp.js` - Main MCP server
  - `tools/` - Tool implementations
    - `web-tools.js` - Web scraping and search tools
    - `code-tools.js` - Code analysis tools
    - `file-tools.js` - File operation tools
    - `ai-tools.js` - LLM and image analysis tools
- `tools/` - Helper scripts
  - `mcp_installer.py` - Installation utility

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
