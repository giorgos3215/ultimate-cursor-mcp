#!/usr/bin/env node

/**
 * This wrapper script ensures that only proper JSON-RPC responses go to stdout.
 * It runs the simple-mcp.js script with stdout piped to this process,
 * filters the output, and ensures only valid JSON is sent to Cursor.
 */

const { spawn } = require('child_process');
const path = require('path');

// Path to the actual MCP server script
const mcpScriptPath = path.join(__dirname, 'simple-mcp.js');

// Buffer for incomplete lines
let buffer = '';

// Start the MCP server with stdout piped to this process
const mcpProcess = spawn('node', [mcpScriptPath], {
  stdio: ['pipe', 'pipe', 'inherit'] // inherit stderr so error messages are visible
});

// Handle data from the MCP server's stdout
mcpProcess.stdout.on('data', (data) => {
  // Add new data to buffer
  buffer += data.toString();
  
  // Try to extract complete lines
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    
    if (!line) continue;
    
    try {
      const json = JSON.parse(line);
      // Only forward valid JSON-RPC 2.0 responses
      if (json.jsonrpc === '2.0' && json.id && (json.result !== undefined || json.error !== undefined)) {
        process.stdout.write(line + '\n');
      }
    } catch (error) {
      // Log invalid JSON to stderr
      console.error(`Invalid JSON: ${line}`);
    }
  }
});

// Forward stdin to the MCP process
process.stdin.pipe(mcpProcess.stdin);

// Handle process signals
process.on('SIGINT', () => {
  mcpProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  mcpProcess.kill('SIGTERM');
  process.exit(0);
});

// Handle MCP process exit
mcpProcess.on('exit', (code) => {
  // Process any remaining buffered data
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim());
      if (json.jsonrpc === '2.0' && (json.result !== undefined || json.error !== undefined) && json.id !== undefined) {
        process.stdout.write(buffer.trim() + '\n');
      }
    } catch (error) {
      console.error(`Filtered remaining invalid JSON: ${buffer}`);
    }
  }
  process.exit(code);
}); 