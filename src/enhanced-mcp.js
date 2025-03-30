#!/usr/bin/env node

/**
 * Ultimate Self-Evolving Cursor MCP
 * A robust MCP server with memory persistence and .cursorrules integration
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Import tool modules
const webToolsPath = path.join(__dirname, 'tools', 'web-tools.js');
const codeToolsPath = path.join(__dirname, 'tools', 'code-tools.js');
const aiToolsPath = path.join(__dirname, 'tools', 'ai-tools.js');
const dbToolsPath = path.join(__dirname, 'tools', 'db-tools.js');
const fileToolsPath = path.join(__dirname, 'tools', 'file-tools.js');

// Dynamically load tool modules if they exist
let webTools = [];
let handleWebTools = null;
let codeTools = [];
let handleCodeTools = null;
let aiTools = [];
let handleAITools = null;
let dbTools = [];
let handleDBTools = null;
let fileTools = [];
let handleFileTools = null;

try {
  if (fs.existsSync(webToolsPath)) {
    const webToolsModule = require(webToolsPath);
    webTools = webToolsModule.webTools || [];
    handleWebTools = webToolsModule.handleWebTools;
    console.error(`Loaded ${webTools.length} web tools`);
  }
} catch (error) {
  console.error(`Failed to load web tools: ${error.message}`);
}

try {
  if (fs.existsSync(codeToolsPath)) {
    const codeToolsModule = require(codeToolsPath);
    codeTools = codeToolsModule.codeTools || [];
    handleCodeTools = codeToolsModule.handleCodeTools;
    console.error(`Loaded ${codeTools.length} code tools`);
  }
} catch (error) {
  console.error(`Failed to load code tools: ${error.message}`);
}

try {
  if (fs.existsSync(aiToolsPath)) {
    const aiToolsModule = require(aiToolsPath);
    aiTools = aiToolsModule.aiTools || [];
    handleAITools = aiToolsModule.handleAITools;
    console.error(`Loaded ${aiTools.length} AI tools`);
  }
} catch (error) {
  console.error(`Failed to load AI tools: ${error.message}`);
}

try {
  if (fs.existsSync(dbToolsPath)) {
    const dbToolsModule = require(dbToolsPath);
    dbTools = dbToolsModule.dbTools || [];
    handleDBTools = dbToolsModule.handleDBTools;
    console.error(`Loaded ${dbTools.length} DB tools`);
  }
} catch (error) {
  console.error(`Failed to load DB tools: ${error.message}`);
}

try {
  if (fs.existsSync(fileToolsPath)) {
    const fileToolsModule = require(fileToolsPath);
    fileTools = fileToolsModule.fileTools || [];
    handleFileTools = fileToolsModule.handleFileTools;
    console.error(`Loaded ${fileTools.length} file tools`);
  }
} catch (error) {
  console.error(`Failed to load file tools: ${error.message}`);
}

// ======== Configuration ========
const LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'info'; // 'debug', 'info', 'warn', 'error'
const MEMORY_FILE = process.env.MCP_MEMORY_FILE || path.join(process.cwd(), 'memory.json');
const RULES_FILE = process.env.MCP_RULES_FILE || path.join(process.cwd(), '.cursorrules');

// ======== Logging System ========
const LOG_FILE = path.join(process.cwd(), 'mcp.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function log(level, message) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    logStream.write(entry);
  }
}

// ======== Memory System ========
class MemoryManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.memory = {
      default: {},
      lessons: [],
      usage: {
        tools: {}
      },
      stats: {
        startTime: new Date().toISOString(),
        callCount: 0,
        successCount: 0,
        errorCount: 0
      }
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.memory = JSON.parse(data);
        log('info', `Memory loaded from ${this.filePath}`);
      } else {
        log('info', `No memory file found at ${this.filePath}, starting with empty memory`);
      }
    } catch (error) {
      log('error', `Failed to load memory from ${this.filePath}: ${error.message}`);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2), 'utf8');
      log('debug', `Memory saved to ${this.filePath}`);
    } catch (error) {
      log('error', `Failed to save memory to ${this.filePath}: ${error.message}`);
    }
  }

  get(namespace, key) {
    if (!this.memory[namespace]) {
      return undefined;
    }
    return this.memory[namespace][key];
  }

  set(namespace, key, value) {
    if (!this.memory[namespace]) {
      this.memory[namespace] = {};
    }
    this.memory[namespace][key] = value;
    this.save();
  }

  trackToolUsage(toolName, success) {
    // Initialize tool stats if not exists
    if (!this.memory.usage.tools[toolName]) {
      this.memory.usage.tools[toolName] = {
        called: 0,
        succeeded: 0,
        failed: 0,
        lastCalled: null
      };
    }

    // Update tool stats
    const stats = this.memory.usage.tools[toolName];
    stats.called++;
    if (success) {
      stats.succeeded++;
    } else {
      stats.failed++;
    }
    stats.lastCalled = new Date().toISOString();

    // Update global stats
    this.memory.stats.callCount++;
    if (success) {
      this.memory.stats.successCount++;
    } else {
      this.memory.stats.errorCount++;
    }

    this.save();
  }

  learnLesson(lesson, category = "general") {
    if (!lesson || typeof lesson !== 'string' || lesson.trim() === '') {
      log('warn', 'Attempted to learn an empty or invalid lesson');
      return false;
    }

    // Check if this lesson already exists
    const isDuplicate = this.memory.lessons.some(
      existingLesson => existingLesson.lesson === lesson
    );

    if (isDuplicate) {
      log('debug', `Lesson already exists: "${lesson}"`);
      return false;
    }

    // Add lesson to memory
    this.memory.lessons.push({
      lesson,
      category,
      timestamp: new Date().toISOString(),
      applied: false
    });

    // Try to update .cursorrules file
    const updated = this.updateCursorRules(lesson);
    if (updated) {
      // Mark the lesson as applied in memory
      this.memory.lessons[this.memory.lessons.length - 1].applied = true;
    }

    this.save();
    return true;
  }

  updateCursorRules(lesson) {
    try {
      if (!fs.existsSync(RULES_FILE)) {
        log('warn', `Cursor rules file not found at ${RULES_FILE}`);
        return false;
      }

      const content = fs.readFileSync(RULES_FILE, 'utf8');
      
      // Look for the Lessons section
      const lessonsMatch = content.match(/# Lessons\s+/);
      if (!lessonsMatch) {
        log('warn', 'Could not find Lessons section in .cursorrules file');
        return false;
      }

      // Insert the new lesson
      const lessonsIndex = lessonsMatch.index + lessonsMatch[0].length;
      const newLesson = `- ${lesson}\n`;
      const updatedContent = content.slice(0, lessonsIndex) + newLesson + content.slice(lessonsIndex);
      
      // Write the updated content back
      fs.writeFileSync(RULES_FILE, updatedContent, 'utf8');
      log('info', `Updated .cursorrules with lesson: "${lesson}"`);
      return true;
    } catch (error) {
      log('error', `Failed to update .cursorrules: ${error.message}`);
      return false;
    }
  }
}

// Initialize memory manager
const memoryManager = new MemoryManager(MEMORY_FILE);

// ======== Tool Implementations ========
// Basic tool definitions
const basicTools = [
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
  },
  {
    name: "save_to_memory",
    description: "Save information to persistent memory",
    schema: {
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
    schema: {
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
    schema: {
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
  },
  {
    name: "read_file",
    description: "Read the contents of a file",
    schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to read"
        },
        encoding: {
          type: "string",
          description: "Optional encoding (default: utf8)",
          default: "utf8"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file",
    schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to write"
        },
        content: {
          type: "string",
          description: "The content to write to the file"
        },
        encoding: {
          type: "string",
          description: "Optional encoding (default: utf8)",
          default: "utf8"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "execute_command",
    description: "Execute a shell command",
    schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command to execute"
        },
        cwd: {
          type: "string",
          description: "Optional working directory"
        }
      },
      required: ["command"]
    }
  },
  {
    name: "get_tool_stats",
    description: "Get statistics about tool usage",
    schema: {
      type: "object",
      properties: {
        toolName: {
          type: "string",
          description: "Optional tool name to get stats for"
        }
      }
    }
  },
  {
    name: "get_learned_lessons",
    description: "Get all the lessons that have been learned",
    schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category to filter by"
        }
      }
    }
  }
];

// Combine all tools
const tools = [...basicTools, ...webTools, ...codeTools, ...aiTools, ...dbTools, ...fileTools];

// Tool implementation handlers
async function handleToolCall(toolName, params) {
  log('debug', `Tool call: ${toolName} with params: ${JSON.stringify(params)}`);
  let result;
  let success = false;

  try {
    // First check if it's a specialized tool
    if (handleWebTools && webTools.some(tool => tool.name === toolName)) {
      result = await handleWebTools(toolName, params);
      success = !result.isError;
      memoryManager.trackToolUsage(toolName, success);
      return result;
    }

    if (handleCodeTools && codeTools.some(tool => tool.name === toolName)) {
      result = await handleCodeTools(toolName, params);
      success = !result.isError;
      memoryManager.trackToolUsage(toolName, success);
      return result;
    }

    if (handleAITools && aiTools.some(tool => tool.name === toolName)) {
      result = await handleAITools(toolName, params);
      success = !result.isError;
      memoryManager.trackToolUsage(toolName, success);
      return result;
    }

    if (handleDBTools && dbTools.some(tool => tool.name === toolName)) {
      result = await handleDBTools(toolName, params);
      success = !result.isError;
      memoryManager.trackToolUsage(toolName, success);
      return result;
    }

    if (handleFileTools && fileTools.some(tool => tool.name === toolName)) {
      result = await handleFileTools(toolName, params);
      success = !result.isError;
      memoryManager.trackToolUsage(toolName, success);
      return result;
    }

    // Handle basic tools
    switch (toolName) {
      case "hello_world": {
        const name = params?.name || "World";
        result = {
          content: [
            {
              type: "text",
              text: `Hello, ${name}!`
            }
          ]
        };
        success = true;
        break;
      }

      case "save_to_memory": {
        const { key, value, namespace = "default" } = params;
        memoryManager.set(namespace, key, value);
        result = {
          content: [
            {
              type: "text",
              text: `Successfully saved information under key "${key}" in namespace "${namespace}"`
            }
          ]
        };
        success = true;
        break;
      }

      case "get_from_memory": {
        const { key, namespace = "default" } = params;
        const value = memoryManager.get(namespace, key);
        
        if (value === undefined) {
          result = {
            content: [
              {
                type: "text",
                text: `No information found for key "${key}" in namespace "${namespace}"`
              }
            ]
          };
        } else {
          result = {
            content: [
              {
                type: "text",
                text: typeof value === 'object' ? JSON.stringify(value) : String(value)
              }
            ]
          };
          success = true;
        }
        break;
      }

      case "learn_lesson": {
        const { lesson, category = "general" } = params;
        const learned = memoryManager.learnLesson(lesson, category);
        
        result = {
          content: [
            {
              type: "text",
              text: learned 
                ? `Successfully recorded lesson in category "${category}"`
                : `Lesson already exists or is invalid`
            }
          ]
        };
        success = learned;
        break;
      }

      case "read_file": {
        const { path: filePath, encoding = "utf8" } = params;
        
        // Sanitize path to prevent directory traversal
        const sanitizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        
        if (!fs.existsSync(sanitizedPath)) {
          result = {
            isError: true,
            content: [
              {
                type: "text",
                text: `File not found: ${sanitizedPath}`
              }
            ]
          };
        } else {
          const content = fs.readFileSync(sanitizedPath, encoding);
          result = {
            content: [
              {
                type: "text",
                text: content
              }
            ]
          };
          success = true;
        }
        break;
      }

      case "write_file": {
        const { path: filePath, content, encoding = "utf8" } = params;
        
        // Sanitize path to prevent directory traversal
        const sanitizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        
        // Ensure directory exists
        const dirname = path.dirname(sanitizedPath);
        if (!fs.existsSync(dirname)) {
          fs.mkdirSync(dirname, { recursive: true });
        }
        
        fs.writeFileSync(sanitizedPath, content, encoding);
        result = {
          content: [
            {
              type: "text",
              text: `Successfully wrote to file: ${sanitizedPath}`
            }
          ]
        };
        success = true;
        break;
      }

      case "execute_command": {
        const { command, cwd = process.cwd() } = params;
        
        // Execute command and return result
        const execPromise = new Promise((resolve, reject) => {
          exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
              reject(error);
              return;
            }
            
            resolve({ stdout, stderr });
          });
        });
        
        try {
          const { stdout, stderr } = await execPromise;
          result = {
            content: [
              {
                type: "text",
                text: `Command output:\n${stdout}`
              }
            ]
          };
          
          if (stderr) {
            result.content.push({
              type: "text",
              text: `Errors/Warnings:\n${stderr}`
            });
          }
          
          success = true;
        } catch (error) {
          result = {
            isError: true,
            content: [
              {
                type: "text",
                text: `Command execution failed: ${error.message}`
              }
            ]
          };
        }
        break;
      }

      case "get_tool_stats": {
        const { toolName } = params;
        const toolStats = memoryManager.memory.usage.tools;
        
        if (toolName && toolStats[toolName]) {
          result = {
            content: [
              {
                type: "text",
                text: `Statistics for tool "${toolName}":\n` + 
                      `- Called: ${toolStats[toolName].called} times\n` +
                      `- Success rate: ${(toolStats[toolName].succeeded / toolStats[toolName].called * 100).toFixed(1)}%\n` +
                      `- Last called: ${toolStats[toolName].lastCalled}`
              }
            ]
          };
        } else if (toolName) {
          result = {
            content: [
              {
                type: "text",
                text: `No statistics found for tool "${toolName}"`
              }
            ]
          };
        } else {
          // Return stats for all tools
          const statsSummary = Object.entries(toolStats)
            .sort((a, b) => b[1].called - a[1].called) // Sort by most used
            .map(([name, stats]) => {
              const successRate = stats.called > 0 ? 
                (stats.succeeded / stats.called * 100).toFixed(1) + '%' : 
                'N/A';
              
              return `- ${name}: Called ${stats.called} times, Success rate: ${successRate}`;
            })
            .join('\n');
          
          result = {
            content: [
              {
                type: "text",
                text: `Tool Usage Statistics:\n\nTotal calls: ${memoryManager.memory.stats.callCount}\n` +
                      `Overall success rate: ${(memoryManager.memory.stats.successCount / memoryManager.memory.stats.callCount * 100).toFixed(1)}%\n\n` +
                      `${statsSummary}`
              }
            ]
          };
        }
        
        success = true;
        break;
      }

      case "get_learned_lessons": {
        const { category } = params;
        const lessons = memoryManager.memory.lessons;
        
        const filteredLessons = category ? 
          lessons.filter(lesson => lesson.category === category) : 
          lessons;
        
        if (filteredLessons.length === 0) {
          result = {
            content: [
              {
                type: "text",
                text: category ? 
                  `No lessons found in category "${category}"` : 
                  'No lessons have been learned yet'
              }
            ]
          };
        } else {
          // Group lessons by category
          const lessonsByCategory = {};
          
          for (const lesson of filteredLessons) {
            if (!lessonsByCategory[lesson.category]) {
              lessonsByCategory[lesson.category] = [];
            }
            lessonsByCategory[lesson.category].push(lesson);
          }
          
          let formattedLessons = '';
          
          for (const [category, categoryLessons] of Object.entries(lessonsByCategory)) {
            formattedLessons += `\n## ${category}\n\n`;
            
            for (const lesson of categoryLessons) {
              formattedLessons += `- ${lesson.lesson}\n`;
            }
          }
          
          result = {
            content: [
              {
                type: "text",
                text: `Learned Lessons:${formattedLessons}`
              }
            ]
          };
        }
        
        success = true;
        break;
      }

      default:
        result = {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown tool: ${toolName}`
            }
          ]
        };
    }
  } catch (error) {
    log('error', `Error handling tool ${toolName}: ${error.message}`);
    result = {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error while using tool ${toolName}: ${error.message}`
        }
      ]
    };
  }

  // Track tool usage for self-improvement
  memoryManager.trackToolUsage(toolName, success);
  return result;
}

// ======== JSON-RPC Protocol Handler ========
// Validate JSON-RPC request
function validateJsonRpcRequest(request) {
  if (!request || 
      typeof request !== 'object' ||
      request.jsonrpc !== "2.0" || 
      !request.method || 
      request.id === null ||
      request.id === undefined) {
    return false;
  }
  return true;
}

// Create standard JSON-RPC response
function createJsonRpcResponse(id, result = null, error = null) {
  const response = {
    jsonrpc: "2.0",
    id: id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  return response;
}

// Handle JSON-RPC request
async function handleJsonRpcRequest(request) {
  try {
    // Validate request
    if (!validateJsonRpcRequest(request)) {
      return createJsonRpcResponse(
        request?.id || null, 
        null, 
        {
          code: -32600,
          message: "Invalid Request: Not a valid JSON-RPC 2.0 request"
        }
      );
    }
    
    // Handle request based on method
    switch (request.method) {
      case "mcp.ListTools":
        return createJsonRpcResponse(request.id, {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema
          }))
        });
      
      case "mcp.CallTool":
        if (!request.params || !request.params.name) {
          return createJsonRpcResponse(
            request.id, 
            null, 
            {
              code: -32602,
              message: "Invalid params: Missing tool name"
            }
          );
        }
        
        try {
          const result = await handleToolCall(
            request.params.name, 
            request.params.arguments || {}
          );
          return createJsonRpcResponse(request.id, result);
        } catch (error) {
          return createJsonRpcResponse(
            request.id, 
            null, 
            {
              code: -32603,
              message: `Internal error: ${error.message}`
            }
          );
        }
      
      default:
        return createJsonRpcResponse(
          request.id, 
          null, 
          {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        );
    }
  } catch (error) {
    log('error', `Error processing request: ${error.message}`);
    return createJsonRpcResponse(
      request?.id || null, 
      null, 
      {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    );
  }
}

// ======== Setup I/O ========
// Set up readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incomplete messages
let buffer = '';

// Process JSON-RPC messages
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  processBuffer();
});

async function processBuffer() {
  const newlineIndex = buffer.indexOf('\n');
  if (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    
    if (line.trim()) {
      try {
        const request = JSON.parse(line);
        log('debug', `Received request: ${JSON.stringify(request)}`);
        
        const response = await handleJsonRpcRequest(request);
        log('debug', `Sending response: ${JSON.stringify(response)}`);
        
        console.log(JSON.stringify(response));
      } catch (error) {
        log('error', `Failed to parse request: ${error.message}`);
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error"
          }
        }));
      }
    }
    
    // Continue processing if there are more newlines in the buffer
    if (buffer.includes('\n')) {
      processBuffer();
    }
  }
}

// ======== Graceful Shutdown ========
// Handle process signals
process.on('SIGINT', () => {
  log('info', 'Received SIGINT signal, shutting down...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM signal, shutting down...');
  cleanup();
  process.exit(0);
});

// Clean up resources before exit
function cleanup() {
  rl.close();
  logStream.end();
}

// ======== Self-Improvement ========
// Analyze tool usage patterns and suggest improvements periodically
setInterval(() => {
  try {
    log('debug', 'Running self-improvement analysis...');
    
    // Check for tools with high error rates
    const toolUsage = memoryManager.memory.usage.tools;
    
    for (const [toolName, stats] of Object.entries(toolUsage)) {
      if (stats.called >= 10) { // Only consider tools with enough usage data
        const errorRate = stats.failed / stats.called;
        
        if (errorRate > 0.3) { // If more than 30% of calls fail
          const lesson = `Improve error handling for tool "${toolName}" which has a ${(errorRate * 100).toFixed(1)}% failure rate`;
          memoryManager.learnLesson(lesson, "tools");
        }
      }
    }
  } catch (error) {
    log('error', `Self-improvement analysis failed: ${error.message}`);
  }
}, 60 * 60 * 1000); // Run every hour

// Initialize
log('info', 'Ultimate Self-Evolving Cursor MCP started'); 