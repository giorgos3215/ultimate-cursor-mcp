import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { createLLMTool } from './tools/llm';
import { createWebScraperTool } from './tools/web-scraper';
import { createSearchEngineTool } from './tools/search-engine';
import { createScreenshotTool } from './tools/screenshot';
import { createSetupTool } from './tools/setup';
import { MemoryManager } from './memory/memory-manager';

// Load environment variables
dotenv.config();

// Initialize memory manager for persistent context
const memoryManager = new MemoryManager();

// Define tool schemas
const toolSchemas = [
  // LLM tool
  {
    name: 'query_llm',
    description: 'Query a large language model with a prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to the LLM',
        },
        provider: {
          type: 'string',
          description: 'The LLM provider to use (openai, anthropic, gemini, local)',
          enum: ['openai', 'anthropic', 'gemini', 'local'],
          default: 'openai',
        },
        image_path: {
          type: 'string',
          description: 'Optional path to an image file to include with the prompt',
        },
      },
      required: ['prompt'],
    },
  },
  
  // Web scraper tool
  {
    name: 'web_scrape',
    description: 'Scrape content from a webpage',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scrape',
        },
        selector: {
          type: 'string',
          description: 'Optional CSS selector to target specific elements',
        },
        max_content_length: {
          type: 'number',
          description: 'Maximum content length to return',
          default: 10000,
        },
      },
      required: ['url'],
    },
  },
  
  // Search engine tool
  {
    name: 'search',
    description: 'Search the web using a search engine',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
  
  // Screenshot tool
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of a webpage',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to take a screenshot of',
        },
        output: {
          type: 'string',
          description: 'The output filename',
          default: 'screenshot.png',
        },
        width: {
          type: 'number',
          description: 'The width of the screenshot in pixels',
          default: 1280,
        },
        height: {
          type: 'number',
          description: 'The height of the screenshot in pixels',
          default: 800,
        },
      },
      required: ['url'],
    },
  },
  
  // Setup tool for installing and managing MCP servers
  {
    name: 'setup',
    description: 'Install, configure, verify, or uninstall MCP servers',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['install', 'verify', 'configure', 'uninstall'],
        },
        package_name: {
          type: 'string',
          description: 'The name of the package to install or uninstall',
        },
        path: {
          type: 'string',
          description: 'The path to a local MCP server to install',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments to pass to the MCP server',
        },
        env: {
          type: 'array',
          items: { type: 'string' },
          description: 'Environment variables to set for the MCP server (format: KEY=VALUE)',
        },
      },
      required: ['action'],
    },
  },
  
  // Memory management tools
  {
    name: 'save_to_memory',
    description: 'Save information to persistent memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to store the information under',
        },
        value: {
          type: 'string',
          description: 'The information to store',
        },
        namespace: {
          type: 'string',
          description: 'Optional namespace for organizing memory',
          default: 'default',
        },
      },
      required: ['key', 'value'],
    },
  },
  
  {
    name: 'get_from_memory',
    description: 'Retrieve information from persistent memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to retrieve information for',
        },
        namespace: {
          type: 'string',
          description: 'Optional namespace for organizing memory',
          default: 'default',
        },
      },
      required: ['key'],
    },
  },
  
  // Self-improvement tool
  {
    name: 'learn_lesson',
    description: 'Record a lesson learned for future improvement',
    inputSchema: {
      type: 'object',
      properties: {
        lesson: {
          type: 'string',
          description: 'The lesson to record',
        },
        category: {
          type: 'string',
          description: 'Category for the lesson',
          enum: ['general', 'coding', 'tools', 'cursor', 'MCP'],
          default: 'general',
        },
      },
      required: ['lesson'],
    },
  },
];

// Handle tool calls
async function handleToolCall(toolName: string, input: any) {
  try {
    switch (toolName) {
      case 'query_llm':
        return await createLLMTool()(input);
        
      case 'web_scrape':
        return await createWebScraperTool()(input);
        
      case 'search':
        return await createSearchEngineTool()(input);
        
      case 'take_screenshot':
        return await createScreenshotTool()(input);
        
      case 'setup':
        return await createSetupTool()(input);
        
      case 'save_to_memory':
        const { key, value, namespace = 'default' } = input;
        await memoryManager.save(namespace, key, value);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully saved information under key "${key}" in namespace "${namespace}"`,
            },
          ],
        };
        
      case 'get_from_memory':
        const { key: getKey, namespace: getNamespace = 'default' } = input;
        const memoryValue = await memoryManager.get(getNamespace, getKey);
        return {
          content: [
            {
              type: 'text',
              text: memoryValue || `No information found for key "${getKey}" in namespace "${getNamespace}"`,
            },
          ],
        };
        
      case 'learn_lesson':
        const { lesson, category = 'general' } = input;
        await memoryManager.learnLesson(category, lesson);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully recorded lesson in category "${category}"`,
            },
          ],
        };
        
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${toolName}`,
            },
          ],
        };
    }
  } catch (error) {
    console.error(`Error handling tool ${toolName}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error using tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

// Simple stdio-based interface for testing
function createStdioInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  console.log('Cursor Evolve MCP server started');
  console.log('Available tools:');
  toolSchemas.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });
  
  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      
      // Handle list tools request
      if (request.type === 'list_tools') {
        const response = {
          id: request.id,
          tools: toolSchemas,
        };
        console.log(JSON.stringify(response));
        return;
      }
      
      // Handle call tool request
      if (request.type === 'call_tool') {
        const { name, input } = request.tool;
        const result = await handleToolCall(name, input);
        
        const response = {
          id: request.id,
          result,
        };
        
        console.log(JSON.stringify(response));
        return;
      }
      
      // Unknown request type
      console.log(JSON.stringify({
        id: request.id,
        error: `Unknown request type: ${request.type}`,
      }));
      
    } catch (error) {
      console.error('Error processing request:', error);
      console.log(JSON.stringify({
        error: `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  });
  
  rl.on('close', () => {
    console.log('MCP server stopped');
    process.exit(0);
  });
}

// Start the server
createStdioInterface(); 