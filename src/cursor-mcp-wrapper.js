#!/usr/bin/env node

/**
 * Ultimate Self-Evolving Cursor MCP Wrapper
 * 
 * This wrapper ensures reliable operation of the MCP server within Cursor:
 * - Handles process management
 * - Manages stdout/stderr routing
 * - Restarts the server if it crashes
 * - Validates JSON-RPC responses
 * - Logs errors to a separate file
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ======== Configuration ========
const MCP_SERVER_SCRIPT = process.env.MCP_SERVER_SCRIPT || path.join(__dirname, 'enhanced-mcp.js');
const LOG_FILE = path.join(process.cwd(), 'mcp-cursor.log');
const MAX_RESTARTS = 5;
const RESTART_DELAY = 1000; // 1 second

// ======== Logging ========
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  logStream.write(entry);
}

// ======== Process Management ========
let restartCount = 0;
let mcpProcess = null;

// Start the MCP server process
function startMcpServer() {
  try {
    // Make the script executable if it isn't already
    try {
      fs.chmodSync(MCP_SERVER_SCRIPT, '755');
    } catch (error) {
      log(`Warning: Could not set executable permissions on ${MCP_SERVER_SCRIPT}: ${error.message}`);
    }

    log(`Starting MCP server from ${MCP_SERVER_SCRIPT}`);
    
    // Start the process
    mcpProcess = spawn('node', [MCP_SERVER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Set up output handling
    mcpProcess.stdout.on('data', (data) => {
      try {
        // Try to parse as JSON to validate it's a proper JSON-RPC message
        const lines = data.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const parsed = JSON.parse(line);
            
            // Validate that it's a proper JSON-RPC 2.0 response
            if (parsed.jsonrpc !== '2.0' || (parsed.result === undefined && parsed.error === undefined)) {
              log(`Warning: Filtering non-conformant JSON-RPC response: ${line}`);
              continue;
            }
            
            // Forward the valid JSON-RPC response
            process.stdout.write(line + '\n');
          } catch (parseError) {
            log(`Warning: Filtering invalid JSON output: ${line}`);
          }
        }
      } catch (error) {
        log(`Error processing stdout: ${error.message}`);
      }
    });
    
    // Log stderr to our log file, but don't forward it
    mcpProcess.stderr.on('data', (data) => {
      log(`Server stderr: ${data.toString().trim()}`);
    });
    
    // Handle process exit
    mcpProcess.on('exit', (code, signal) => {
      log(`MCP server process exited with code ${code} and signal ${signal}`);
      
      // Restart the process if it crashed (non-zero exit code)
      if (code !== 0 && restartCount < MAX_RESTARTS) {
        restartCount++;
        log(`Restarting MCP server (attempt ${restartCount}/${MAX_RESTARTS})...`);
        
        setTimeout(() => {
          startMcpServer();
        }, RESTART_DELAY);
      } else if (restartCount >= MAX_RESTARTS) {
        log(`Maximum restart attempts (${MAX_RESTARTS}) reached. Giving up.`);
        process.exit(1);
      }
    });
    
    // Handle errors
    mcpProcess.on('error', (error) => {
      log(`Error starting MCP server: ${error.message}`);
      
      if (restartCount < MAX_RESTARTS) {
        restartCount++;
        log(`Restarting MCP server (attempt ${restartCount}/${MAX_RESTARTS})...`);
        
        setTimeout(() => {
          startMcpServer();
        }, RESTART_DELAY);
      } else {
        log(`Maximum restart attempts (${MAX_RESTARTS}) reached. Giving up.`);
        process.exit(1);
      }
    });
    
    // Pipe our stdin to the MCP server's stdin
    process.stdin.pipe(mcpProcess.stdin);
    
  } catch (error) {
    log(`Fatal error starting MCP server: ${error.message}`);
    process.exit(1);
  }
}

// ======== Signal Handling ========
// Handle termination signals
process.on('SIGINT', () => {
  log('Received SIGINT signal, shutting down...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM signal, shutting down...');
  cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`);
  log(error.stack);
  cleanup();
  process.exit(1);
});

// Clean up resources before exit
function cleanup() {
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill();
  }
  logStream.end();
}

// ======== Main ========
// Start the MCP server
log('Ultimate Self-Evolving Cursor MCP wrapper started');
startMcpServer(); 