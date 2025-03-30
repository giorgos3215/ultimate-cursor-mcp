#!/usr/bin/env node

// Strictly implement the JSON-RPC 2.0 protocol for MCP
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Redirect all logs to a file instead of stderr
const logFile = fs.createWriteStream(path.join(process.cwd(), 'mcp-basic.log'), { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  logFile.write(`[${timestamp}] ${message}\n`);
}

// Define the simplest possible tool set
const tools = [
  {
    name: "hello_world",
    description: "A simple hello world tool",
    schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name to greet"
        }
      }
    }
  }
];

// Handle tool calls - only implement hello_world for now
async function callTool(toolName, params) {
  log(`Tool call: ${toolName} with params: ${JSON.stringify(params)}`);
  
  if (toolName === "hello_world") {
    const name = params?.name || "World";
    return {
      content: [
        {
          type: "text",
          text: `Hello, ${name}!`
        }
      ]
    };
  }
  
  throw new Error(`Unknown tool: ${toolName}`);
}

// Set up readline interface for JSON-RPC communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Process JSON-RPC requests
rl.on('line', async (line) => {
  if (!line.trim()) return;
  
  try {
    const request = JSON.parse(line);
    
    // Validate JSON-RPC 2.0 request
    if (!request.jsonrpc || request.jsonrpc !== "2.0" || !request.id) {
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id || null,
        error: {
          code: -32600,
          message: "Invalid Request: Not a valid JSON-RPC 2.0 request"
        }
      }));
      return;
    }
    
    // Process the request
    let response;
    
    if (request.method === "mcp.ListTools") {
      response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: tools
        }
      };
    } 
    else if (request.method === "mcp.CallTool") {
      if (!request.params || !request.params.name) {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32602,
            message: "Invalid params: Missing tool name"
          }
        };
      } else {
        try {
          const result = await callTool(
            request.params.name, 
            request.params.arguments || {}
          );
          
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: result
          };
        } catch (error) {
          response = {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: `Internal error: ${error.message}`
            }
          };
        }
      }
    } 
    else {
      response = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        }
      };
    }
    
    // Send the response
    console.log(JSON.stringify(response));
  } 
  catch (error) {
    log(`Error processing request: ${error.message}`);
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error"
      }
    }));
  }
});

// Handle process signals
process.on('SIGINT', () => {
  log('Received SIGINT signal');
  logFile.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM signal');
  logFile.end();
  process.exit(0);
});

// Log startup without printing to stdout
log("MCP server started"); 