#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
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

// Create MCP server
const server = new Server(
  {
    name: "ultimate-cursor-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle ListTools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_llm",
        description: "Query a large language model with a prompt",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt to send to the LLM",
            },
            provider: {
              type: "string",
              description: "The LLM provider to use (openai, anthropic, gemini, local)",
            },
            image_path: {
              type: "string",
              description: "Optional path to an image file to include with the prompt",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "web_scrape",
        description: "Scrape content from a webpage",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape",
            },
            selector: {
              type: "string",
              description: "Optional CSS selector to target specific elements",
            },
            max_content_length: {
              type: "number",
              description: "Maximum content length to return",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "search",
        description: "Search the web using a search engine",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "take_screenshot",
        description: "Take a screenshot of a webpage",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to take a screenshot of",
            },
            output: {
              type: "string",
              description: "The output filename",
            },
            width: {
              type: "number",
              description: "The width of the screenshot in pixels",
            },
            height: {
              type: "number",
              description: "The height of the screenshot in pixels",
            },
          },
          required: ["url"],
        },
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
              enum: ["install", "verify", "configure", "uninstall"],
            },
            package_name: {
              type: "string",
              description: "The name of the package to install or uninstall",
            },
            path: {
              type: "string",
              description: "The path to a local MCP server to install",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "Arguments to pass to the MCP server",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "Environment variables to set for the MCP server (format: KEY=VALUE)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "save_to_memory",
        description: "Save information to persistent memory",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The key to store the information under",
            },
            value: {
              type: "string",
              description: "The information to store",
            },
            namespace: {
              type: "string",
              description: "Optional namespace for organizing memory",
            },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "get_from_memory",
        description: "Retrieve information from persistent memory",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The key to retrieve information for",
            },
            namespace: {
              type: "string",
              description: "Optional namespace for organizing memory",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "learn_lesson",
        description: "Record a lesson learned for future improvement",
        inputSchema: {
          type: "object",
          properties: {
            lesson: {
              type: "string",
              description: "The lesson to record",
            },
            category: {
              type: "string",
              description: "Category for the lesson",
              enum: ["general", "coding", "tools", "cursor", "MCP"],
            },
          },
          required: ["lesson"],
        },
      },
    ],
  };
});

// Handle CallTool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "query_llm": {
        const input = args as { prompt: string; provider?: string; image_path?: string };
        return await createLLMTool()(input);
      }

      case "web_scrape": {
        const input = args as { url: string; selector?: string; max_content_length?: number };
        return await createWebScraperTool()(input);
      }

      case "search": {
        const input = args as { query: string; max_results?: number };
        return await createSearchEngineTool()(input);
      }

      case "take_screenshot": {
        const input = args as { url: string; output?: string; width?: number; height?: number };
        return await createScreenshotTool()(input);
      }

      case "setup": {
        const input = args as { action: string; package_name?: string; path?: string; args?: string[]; env?: string[] };
        return await createSetupTool()(input);
      }

      case "save_to_memory": {
        const { key, value, namespace = "default" } = args as { key: string; value: string; namespace?: string };
        await memoryManager.save(namespace, key, value);
        return {
          content: [
            {
              type: "text",
              text: `Successfully saved information under key "${key}" in namespace "${namespace}"`,
            },
          ],
        };
      }

      case "get_from_memory": {
        const { key, namespace = "default" } = args as { key: string; namespace?: string };
        const memoryValue = memoryManager.get(namespace, key);
        return {
          content: [
            {
              type: "text",
              text: memoryValue || `No information found for key "${key}" in namespace "${namespace}"`,
            },
          ],
        };
      }

      case "learn_lesson": {
        const { lesson, category = "general" } = args as { lesson: string; category?: string };
        await memoryManager.learnLesson(lesson, category);
        return {
          content: [
            {
              type: "text",
              text: `Successfully recorded lesson in category "${category}"`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error handling tool:`, error);
    throw error;
  }
});

// Log server info
console.log('Ultimate Cursor MCP server started');
console.log('Available tools:');

// Start the server
new StdioServerTransport().start(server); 