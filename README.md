# Ultimate Self-Evolving Cursor MCP

A comprehensive, self-improving Model Context Protocol toolkit for Cursor IDE that evolves based on usage patterns and feedback.

## Overview

This project is an enhanced, rebranded version of `devin.cursorrules` with improved tools implementation, self-evolution capabilities, and optimized Cursor integration. It's designed to be completely accessible and free with no reliance on paid services.

The Ultimate Self-Evolving Cursor MCP provides a suite of tools for AI assistance, including:

- Web scraping and search capabilities
- Screenshot capture and analysis
- LLM integration with multiple providers
- Persistent memory management
- Analytics and self-improvement mechanisms
- Built-in MCP server management

## Features

- **Self-evolving**: Learns from interactions and improves over time
- **Dual Implementation**: Python tools with TypeScript fallbacks for maximum compatibility
- **Memory Management**: Persistent storage across sessions with namespace support
- **Comprehensive Tools**: Web scraping, search, screenshots, LLM, and more
- **Analytics**: Usage tracking and automated improvement suggestions
- **Easy Setup**: Built-in setup tool for installing and managing MCP servers
- **Smithery.ai Compatible**: Ready for deployment as a standalone MCP

## Installation

### Prerequisites

- Node.js (v16+)
- Python 3.8+
- Cursor IDE

### Quick Install

```bash
# Clone the repository
git clone https://github.com/yourusername/ultimate-cursor-mcp.git
cd ultimate-cursor-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Install as local MCP
python tools/mcp_installer.py local .
```

### Using the Built-in Setup Tool

Once installed, you can use the built-in setup tool directly from Cursor to manage MCP servers:

1. **Install an MCP server from npm:**
   ```
   Use the setup tool with action: install, package_name: mcp-server-name
   ```

2. **Install from a local folder:**
   ```
   Use the setup tool with action: install, path: /path/to/local/server
   ```

3. **Verify installation:**
   ```
   Use the setup tool with action: verify
   ```

4. **Configure environment variables:**
   ```
   Use the setup tool with action: configure, env: ["KEY1=value1", "KEY2=value2"]
   ```

5. **Uninstall an MCP server:**
   ```
   Use the setup tool with action: uninstall, package_name: mcp-server-name
   ```

### Configuration

Create a `.env` file in the root directory with the following optional configurations:

```
# Optional API keys for enhanced capabilities
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
DEEPSEEK_API_KEY=your_deepseek_key
GEMINI_API_KEY=your_gemini_key

# Customize tool behavior
SEARCH_RESULTS_COUNT=10
DEFAULT_SCREENSHOT_WIDTH=1280
DEFAULT_SCREENSHOT_HEIGHT=800
```

## Usage

### Basic Usage

Once installed, the MCP will be available in Cursor. You can use any of the following tools:

- `query_llm`: Ask questions to an LLM (multiple providers supported)
- `web_scrape`: Extract content from web pages
- `search`: Search the web for information
- `take_screenshot`: Capture screenshots of web pages
- `setup`: Install, configure, and manage MCP servers
- `save_to_memory`/`get_from_memory`: Store and retrieve information
- `learn_lesson`: Record lessons for future reference

### Testing

Run the included test script to verify the MCP is functioning correctly:

```bash
node test.js
```

This will check that all tools are working properly and that memory persistence is functioning.

### Self-Improvement

The MCP automatically tracks tool usage and performance, generating suggestions for improvements. You can view these suggestions in the `.cursorrules` file or generate a comprehensive report:

```typescript
import { SelfImprovement } from './dist/self-evolution/improvement';
import { MemoryManager } from './dist/memory/memory-manager';

const memoryManager = new MemoryManager();
const improvement = new SelfImprovement(memoryManager);

// Generate and save a report
improvement.generateReport('./reports/improvement-report.md');
```

## Development

### Project Structure

```
├── dist/               # Compiled JavaScript files
├── src/                # TypeScript source code
│   ├── index.ts        # Main entry point
│   ├── tools/          # Tool implementations
│   │   ├── web-scraper.ts
│   │   ├── search-engine.ts
│   │   ├── screenshot.ts
│   │   └── setup.ts    # MCP management tool
│   ├── memory/         # Memory management
│   └── self-evolution/ # Self-improvement mechanisms
├── tools/              # Python tools
├── test.js             # Test script
└── smithery.yaml       # Smithery.ai configuration
```

### Building

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch for changes during development
npm run watch
```

### Adding New Tools

1. Create a new TypeScript file in `src/tools/`
2. Implement the tool following the existing patterns
3. Add the tool to the registry in `src/index.ts`
4. Update the tool schemas
5. Test your new tool

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
