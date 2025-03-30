#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server functionality
 * 
 * Run this with: node test.js
 */

const { spawn } = require('child_process');
const readline = require('readline');

// A simple MCP client for testing
async function main() {
  console.log('Starting MCP server test...');
  
  // Start the MCP server
  const server = spawn('npx', ['ts-node', 'src/index.ts'], {
    stdio: ['pipe', 'pipe', process.stderr]
  });
  
  // Set up readline interface to read server output
  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity
  });
  
  // Handle server messages
  rl.on('line', (line) => {
    try {
      const message = JSON.parse(line);
      if (message.type === 'response') {
        console.log('\nResponse received:');
        console.log(JSON.stringify(message.data, null, 2));
        console.log();
      }
    } catch (e) {
      console.log('Server output:', line);
    }
  });
  
  // Send requests to the server
  console.log('Testing ListTools request...');
  await sendRequest(server, {
    type: 'request',
    id: '1',
    method: 'ListTools'
  });
  
  // Wait a moment to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test memory store
  console.log('Testing memory storage...');
  await sendRequest(server, {
    type: 'request',
    id: '2',
    method: 'CallTool',
    data: {
      tool: 'save_to_memory',
      input: {
        key: 'test_key',
        value: 'test_value',
        namespace: 'test'
      }
    }
  });
  
  // Wait a moment to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test memory retrieval
  console.log('Testing memory retrieval...');
  await sendRequest(server, {
    type: 'request',
    id: '3',
    method: 'CallTool',
    data: {
      tool: 'get_from_memory',
      input: {
        key: 'test_key',
        namespace: 'test'
      }
    }
  });
  
  // Wait a moment to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test learn lesson
  console.log('Testing lesson learning...');
  await sendRequest(server, {
    type: 'request',
    id: '4',
    method: 'CallTool',
    data: {
      tool: 'learn_lesson',
      input: {
        lesson: 'TypeScript MCP server works successfully!',
        category: 'MCP'
      }
    }
  });
  
  // Wait a moment to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test LLM if API keys are available
  if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    console.log('Testing LLM query...');
    await sendRequest(server, {
      type: 'request',
      id: '5',
      method: 'CallTool',
      data: {
        tool: 'query_llm',
        input: {
          prompt: 'Hello, world!',
          provider: process.env.OPENAI_API_KEY ? 'openai' : 'anthropic'
        }
      }
    });
    
    // Wait a moment to process
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Close the server after testing
  console.log('Tests completed, shutting down server...');
  server.kill();
}

// Helper function to send a request to the server
function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    const requestString = JSON.stringify(request);
    console.log(`Sending request: ${requestString}`);
    server.stdin.write(requestString + '\n');
    resolve();
  });
}

// Run the test
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 