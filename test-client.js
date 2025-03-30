#!/usr/bin/env node

/**
 * Test client for the Ultimate Self-Evolving Cursor MCP
 * This client tests the basic functionality of the MCP server
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Configuration
const MCP_SERVER_SCRIPT = process.env.MCP_SERVER_SCRIPT || path.join(__dirname, 'src/enhanced-mcp.js');
let requestId = 1;

// Start the MCP server process
console.log(`Starting MCP server: ${MCP_SERVER_SCRIPT}`);
const mcpProcess = spawn('node', [MCP_SERVER_SCRIPT], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle server stdout (responses)
mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      console.log('\nReceived response:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error(`Error parsing response: ${line}`);
    }
  }
});

// Handle server stderr (logs)
mcpProcess.stderr.on('data', (data) => {
  console.error(`Server log: ${data.toString().trim()}`);
});

// Handle process exit
mcpProcess.on('exit', (code, signal) => {
  console.log(`MCP server process exited with code ${code} and signal ${signal}`);
  process.exit(0);
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Send a JSON-RPC request to the server
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  
  console.log('\nSending request:');
  console.log(JSON.stringify(request, null, 2));
  
  mcpProcess.stdin.write(JSON.stringify(request) + '\n');
}

// Display main menu
function showMenu() {
  console.log('\n=== MCP Test Client Menu ===');
  console.log('1. List available tools');
  console.log('2. Call "hello_world" tool');
  console.log('3. Save data to memory');
  console.log('4. Get data from memory');
  console.log('5. Learn a lesson');
  console.log('6. Read a file');
  console.log('7. Execute a command');
  console.log('8. Custom tool call');
  
  console.log('\n--- Advanced Web Tools ---');
  console.log('10. Web crawler');
  console.log('11. Semantic search');
  
  console.log('\n--- Advanced Code Tools ---');
  console.log('20. Code analyzer');
  console.log('21. Smart refactor');
  console.log('22. Project insights');
  
  console.log('\n--- Advanced DB Tools ---');
  console.log('30. DB query');
  console.log('31. DB schema');
  
  console.log('\n--- Advanced File Tools ---');
  console.log('40. Find files');
  console.log('41. Watch files');
  console.log('42. Batch process');
  
  console.log('\n--- Advanced AI Tools ---');
  console.log('50. Query LLM');
  console.log('51. Image analysis');
  console.log('52. Text to speech');
  
  console.log('\n0. Exit');
  
  rl.question('\nSelect an option: ', (answer) => {
    switch (answer) {
      case '1':
        sendRequest('mcp.ListTools');
        setTimeout(showMenu, 500);
        break;
      
      case '2':
        rl.question('Enter name (or leave empty for default): ', (name) => {
          sendRequest('mcp.CallTool', {
            name: 'hello_world',
            arguments: name ? { name } : {}
          });
          setTimeout(showMenu, 500);
        });
        break;
      
      case '3':
        rl.question('Enter key: ', (key) => {
          rl.question('Enter value: ', (value) => {
            rl.question('Enter namespace (or leave empty for default): ', (namespace) => {
              const args = { key, value };
              if (namespace) args.namespace = namespace;
              
              sendRequest('mcp.CallTool', {
                name: 'save_to_memory',
                arguments: args
              });
              setTimeout(showMenu, 500);
            });
          });
        });
        break;
      
      case '4':
        rl.question('Enter key: ', (key) => {
          rl.question('Enter namespace (or leave empty for default): ', (namespace) => {
            const args = { key };
            if (namespace) args.namespace = namespace;
            
            sendRequest('mcp.CallTool', {
              name: 'get_from_memory',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
      
      case '5':
        rl.question('Enter lesson to learn: ', (lesson) => {
          rl.question('Enter category (or leave empty for default): ', (category) => {
            const args = { lesson };
            if (category) args.category = category;
            
            sendRequest('mcp.CallTool', {
              name: 'learn_lesson',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
      
      case '6':
        rl.question('Enter file path: ', (path) => {
          sendRequest('mcp.CallTool', {
            name: 'read_file',
            arguments: { path }
          });
          setTimeout(showMenu, 500);
        });
        break;
      
      case '7':
        rl.question('Enter command to execute: ', (command) => {
          sendRequest('mcp.CallTool', {
            name: 'execute_command',
            arguments: { command }
          });
          setTimeout(showMenu, 500);
        });
        break;
      
      case '8':
        rl.question('Enter tool name: ', (toolName) => {
          rl.question('Enter arguments as JSON: ', (argsStr) => {
            try {
              const args = argsStr ? JSON.parse(argsStr) : {};
              sendRequest('mcp.CallTool', {
                name: toolName,
                arguments: args
              });
            } catch (error) {
              console.error(`Error parsing arguments: ${error.message}`);
            }
            setTimeout(showMenu, 500);
          });
        });
        break;
      
      // Advanced Web Tools
      case '10':
        rl.question('Enter start URL: ', (startUrl) => {
          rl.question('Max pages to crawl (default: 3): ', (maxPages) => {
            rl.question('Stay within domain? (y/n, default: y): ', (stayWithinDomain) => {
              const args = { 
                start_url: startUrl,
                max_pages: maxPages ? parseInt(maxPages) : 3,
                stay_within_domain: stayWithinDomain.toLowerCase() !== 'n'
              };
              
              sendRequest('mcp.CallTool', {
                name: 'web_crawler',
                arguments: args
              });
              setTimeout(showMenu, 1000);
            });
          });
        });
        break;
        
      case '11':
        rl.question('Enter search query: ', (query) => {
          rl.question('Depth (basic/detailed/comprehensive, default: detailed): ', (depth) => {
            rl.question('Format (summary/quotes/structured/comparative, default: summary): ', (format) => {
              const args = { 
                query,
                depth: depth || 'detailed',
                extract_format: format || 'summary'
              };
              
              sendRequest('mcp.CallTool', {
                name: 'semantic_search',
                arguments: args
              });
              setTimeout(showMenu, 1000);
            });
          });
        });
        break;
      
      // Advanced Code Tools
      case '20':
        rl.question('Enter file path to analyze: ', (filePath) => {
          rl.question('Operation (complexity/dependencies/structure/security/quality): ', (operation) => {
            const args = { 
              file_path: filePath,
              operation: operation || 'complexity'
            };
            
            sendRequest('mcp.CallTool', {
              name: 'code_analyzer',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
        
      case '21':
        rl.question('Enter file path to refactor: ', (filePath) => {
          rl.question('Refactoring type (extract_method/rename/optimize/modernize): ', (refactoringType) => {
            const args = { 
              file_path: filePath,
              refactoring_type: refactoringType || 'optimize',
              dry_run: true
            };
            
            sendRequest('mcp.CallTool', {
              name: 'smart_refactor',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
        
      case '22':
        rl.question('Enter project directory: ', (projectDir) => {
          rl.question('Insight type (architecture/patterns/dependencies/issues): ', (insightType) => {
            const args = { 
              project_dir: projectDir,
              insight_type: insightType || 'architecture'
            };
            
            sendRequest('mcp.CallTool', {
              name: 'project_insights',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
      
      // Advanced DB Tools  
      case '30':
        rl.question('Enter database path: ', (dbPath) => {
          rl.question('Enter SQL query: ', (query) => {
            const args = { 
              db_path: dbPath,
              query: query
            };
            
            sendRequest('mcp.CallTool', {
              name: 'db_query',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
        
      case '31':
        rl.question('Enter database path: ', (dbPath) => {
          rl.question('Table name (optional): ', (tableName) => {
            const args = { 
              db_path: dbPath
            };
            if (tableName) args.table_name = tableName;
            
            sendRequest('mcp.CallTool', {
              name: 'db_schema',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
      
      // Advanced File Tools
      case '40':
        rl.question('Enter file pattern to search for: ', (pattern) => {
          rl.question('Ignore pattern (optional): ', (ignorePattern) => {
            const args = { 
              pattern: pattern
            };
            if (ignorePattern) args.ignore_pattern = ignorePattern;
            
            sendRequest('mcp.CallTool', {
              name: 'find_files',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
        
      case '41':
        rl.question('Enter path pattern to watch: ', (pathPattern) => {
          rl.question('Timeout in ms (default: 5000): ', (timeout) => {
            const args = { 
              path_pattern: pathPattern,
              timeout: timeout ? parseInt(timeout) : 5000
            };
            
            sendRequest('mcp.CallTool', {
              name: 'watch_files',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
        
      case '42':
        rl.question('Enter file pattern to process: ', (pattern) => {
          rl.question('Search text: ', (searchText) => {
            rl.question('Replace text: ', (replaceText) => {
              rl.question('Dry run? (y/n, default: y): ', (dryRun) => {
                const args = { 
                  pattern: pattern,
                  search_text: searchText,
                  replace_text: replaceText,
                  dry_run: dryRun.toLowerCase() !== 'n'
                };
                
                sendRequest('mcp.CallTool', {
                  name: 'batch_process',
                  arguments: args
                });
                setTimeout(showMenu, 500);
              });
            });
          });
        });
        break;
      
      // Advanced AI Tools
      case '50':
        rl.question('Enter prompt for LLM: ', (prompt) => {
          rl.question('Provider (openai/anthropic/local, default: local): ', (provider) => {
            const args = { 
              prompt: prompt,
              provider: provider || 'local'
            };
            
            sendRequest('mcp.CallTool', {
              name: 'query_llm',
              arguments: args
            });
            setTimeout(showMenu, 1000);
          });
        });
        break;
        
      case '51':
        rl.question('Enter image path: ', (imagePath) => {
          rl.question('Task (describe/detect_objects/ocr/custom, default: describe): ', (task) => {
            const args = { 
              image_path: imagePath,
              task: task || 'describe'
            };
            
            sendRequest('mcp.CallTool', {
              name: 'image_analysis',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
        
      case '52':
        rl.question('Enter text: ', (text) => {
          rl.question('Output path: ', (outputPath) => {
            const args = { 
              text: text,
              output_path: outputPath
            };
            
            sendRequest('mcp.CallTool', {
              name: 'text_to_speech',
              arguments: args
            });
            setTimeout(showMenu, 500);
          });
        });
        break;
      
      case '0':
        console.log('Exiting...');
        mcpProcess.kill();
        rl.close();
        break;
      
      default:
        console.log('Invalid option');
        showMenu();
    }
  });
}

// Start the client
console.log('MCP Test Client started');
showMenu(); 