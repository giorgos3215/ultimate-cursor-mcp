#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Try to load tools (fallback gracefully if they don't exist)
let llmTool, webScraperTool, searchEngineTool, screenshotTool, setupTool;
try {
  const toolsPath = path.join(__dirname, 'tools');
  if (fs.existsSync(path.join(toolsPath, 'llm.js'))) {
    llmTool = require('./tools/llm').createLLMTool();
  }
  if (fs.existsSync(path.join(toolsPath, 'web-scraper.js'))) {
    webScraperTool = require('./tools/web-scraper').createWebScraperTool();
  }
  if (fs.existsSync(path.join(toolsPath, 'search-engine.js'))) {
    searchEngineTool = require('./tools/search-engine').createSearchEngineTool();
  }
  if (fs.existsSync(path.join(toolsPath, 'screenshot.js'))) {
    screenshotTool = require('./tools/screenshot').createScreenshotTool();
  }
  if (fs.existsSync(path.join(toolsPath, 'setup.js'))) {
    setupTool = require('./tools/setup').createSetupTool();
  }
} catch (error) {
  console.error('Error loading tools:', error);
}

// Simple in-memory storage
const memory = {
  default: {},
  lessons: []
};

// Try to load memory file if it exists
const memoryFilePath = path.join(process.cwd(), 'memory.json');
try {
  if (fs.existsSync(memoryFilePath)) {
    const data = fs.readFileSync(memoryFilePath, 'utf8');
    const loadedMemory = JSON.parse(data);
    Object.assign(memory, loadedMemory);
    console.error(`Loaded memory from ${memoryFilePath}`);
  } else {
    console.error(`Memory file not found at ${memoryFilePath}, starting with empty memory`);
  }
} catch (error) {
  console.error('Error loading memory file:', error);
}

// Save memory to file
function saveMemory() {
  try {
    fs.writeFileSync(memoryFilePath, JSON.stringify(memory, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving memory file:', error);
  }
}

// Tool definitions
const tools = [
  {
    name: "query_llm",
    description: "Query a large language model with a prompt",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to send to the LLM"
        },
        provider: {
          type: "string",
          description: "The LLM provider to use (openai, anthropic, gemini, local)"
        },
        image_path: {
          type: "string",
          description: "Optional path to an image file to include with the prompt"
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "web_scrape",
    description: "Scrape content from a webpage",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to scrape"
        },
        selector: {
          type: "string",
          description: "Optional CSS selector to target specific elements"
        },
        max_content_length: {
          type: "number",
          description: "Maximum content length to return"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "search",
    description: "Search the web using a search engine",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of a webpage",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to take a screenshot of"
        },
        output: {
          type: "string",
          description: "The output filename"
        },
        width: {
          type: "number",
          description: "The width of the screenshot in pixels"
        },
        height: {
          type: "number",
          description: "The height of the screenshot in pixels"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "setup",
    description: "Install, configure, verify, or uninstall MCP servers",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The action to perform",
          enum: ["install", "verify", "configure", "uninstall"]
        },
        package_name: {
          type: "string",
          description: "The name of the package to install or uninstall"
        },
        path: {
          type: "string",
          description: "The path to a local MCP server to install"
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Arguments to pass to the MCP server"
        },
        env: {
          type: "array",
          items: { type: "string" },
          description: "Environment variables to set for the MCP server (format: KEY=VALUE)"
        }
      },
      required: ["action"]
    }
  },
  {
    name: "save_to_memory",
    description: "Save information to persistent memory",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key to store the information under"
        },
        value: {
          type: "string",
          description: "The information to store"
        },
        namespace: {
          type: "string",
          description: "Optional namespace for organizing memory"
        }
      },
      required: ["key", "value"]
    }
  },
  {
    name: "get_from_memory",
    description: "Retrieve information from persistent memory",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key to retrieve information for"
        },
        namespace: {
          type: "string",
          description: "Optional namespace for organizing memory"
        }
      },
      required: ["key"]
    }
  },
  {
    name: "learn_lesson",
    description: "Record a lesson learned for future improvement",
    inputSchema: {
      type: "object",
      properties: {
        lesson: {
          type: "string",
          description: "The lesson to record"
        },
        category: {
          type: "string",
          description: "Category for the lesson",
          enum: ["general", "coding", "tools", "cursor", "MCP"]
        }
      },
      required: ["lesson"]
    }
  }
];

// Handle tool calls
async function handleToolCall(toolName, toolInput) {
  try {
    switch (toolName) {
      case "query_llm":
        if (llmTool) {
          return await llmTool(toolInput);
        } else {
          return {
            content: [
              {
                type: "text",
                text: "LLM tool not available. Please check your installation."
              }
            ]
          };
        }

      case "web_scrape":
        if (webScraperTool) {
          return await webScraperTool(toolInput);
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Web scraper tool not available. Please check your installation."
              }
            ]
          };
        }

      case "search":
        if (searchEngineTool) {
          return await searchEngineTool(toolInput);
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Search engine tool not available. Please check your installation."
              }
            ]
          };
        }

      case "take_screenshot":
        if (screenshotTool) {
          return await screenshotTool(toolInput);
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Screenshot tool not available. Please check your installation."
              }
            ]
          };
        }

      case "setup":
        if (setupTool) {
          return await setupTool(toolInput);
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Setup tool not available. Please check your installation."
              }
            ]
          };
        }

      case "save_to_memory": {
        const { key, value, namespace = "default" } = toolInput;
        
        // Create namespace if it doesn't exist
        if (!memory[namespace]) {
          memory[namespace] = {};
        }
        
        // Save to memory
        memory[namespace][key] = value;
        
        // Persist memory
        saveMemory();
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully saved information under key "${key}" in namespace "${namespace}"`
            }
          ]
        };
      }

      case "get_from_memory": {
        const { key, namespace = "default" } = toolInput;
        
        // Get from memory
        const memoryValue = memory[namespace] && memory[namespace][key];
        
        return {
          content: [
            {
              type: "text",
              text: memoryValue || `No information found for key "${key}" in namespace "${namespace}"`
            }
          ]
        };
      }

      case "learn_lesson": {
        const { lesson, category = "general" } = toolInput;
        
        // Add lesson to memory
        memory.lessons.push({
          lesson,
          category,
          timestamp: new Date().toISOString()
        });
        
        // Update .cursorrules file if it exists
        try {
          const cursorRulesPath = path.join(process.cwd(), '.cursorrules');
          if (fs.existsSync(cursorRulesPath)) {
            let content = fs.readFileSync(cursorRulesPath, 'utf8');
            
            // Find the Lessons section
            const lessonsMatch = content.match(/# Lessons\s+/);
            if (lessonsMatch) {
              // Insert the new lesson after the Lessons section
              const lessonsIndex = lessonsMatch.index + lessonsMatch[0].length;
              const newLesson = `- ${lesson}\n`;
              content = content.slice(0, lessonsIndex) + newLesson + content.slice(lessonsIndex);
              
              // Write back to file
              fs.writeFileSync(cursorRulesPath, content, 'utf8');
            }
          }
        } catch (error) {
          console.error('Error updating .cursorrules file:', error);
        }
        
        // Persist memory
        saveMemory();
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully recorded lesson in category "${category}"`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error handling tool ${toolName}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error using tool ${toolName}: ${error.message || String(error)}`
        }
      ]
    };
  }
}

// Handle JSON-RPC 2.0 requests
async function handleJsonRpcRequest(request) {
  // Ensure we have a valid JSON-RPC 2.0 request
  if (!request || request.jsonrpc !== '2.0' || !request.method || !request.id) {
    return {
      jsonrpc: '2.0',
      id: request.id || null,
      error: {
        code: -32600,
        message: 'Invalid Request'
      }
    };
  }

  try {
    switch (request.method) {
      case 'mcp.ListTools':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              schema: tool.inputSchema
            }))
          }
        };
      
      case 'mcp.CallTool':
        if (!request.params || !request.params.name) {
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32602,
              message: "Invalid params: Missing tool name"
            }
          };
        }
        
        try {
          const result = await handleToolCall(request.params.name, request.params.arguments || {});
          return {
            jsonrpc: "2.0",
            id: request.id,
            result
          };
        } catch (error) {
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: `Internal error: ${error.message || String(error)}`
            }
          };
        }
      
      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      jsonrpc: "2.0",
      id: request.id || null,
      error: {
        code: -32700,
        message: `Parse error: ${error.message || String(error)}`
      }
    };
  }
}

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Only log startup messages to stderr
console.error('Ultimate Cursor MCP server started');

// Process incoming lines
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const response = await handleJsonRpcRequest(request);
    // Ensure we output a single line of valid JSON-RPC response
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error('Error processing request:', error);
  }
});

// Handle close event
console.error('Shutting down Ultimate Cursor MCP server');
rl.on('close', () => {
  process.exit(0);
}); 