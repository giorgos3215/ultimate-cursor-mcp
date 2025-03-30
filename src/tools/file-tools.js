/**
 * file-tools.js
 * Advanced file operation tools for the Ultimate Self-Evolving Cursor MCP
 * Capabilities include file watching, batch processing, recursive search and more
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const chokidar = require('chokidar');

// Define file operation tools
const fileTools = [
  {
    name: 'watch_files',
    description: 'Watch files or directories for changes',
    schema: {
      type: 'object',
      properties: {
        path_pattern: {
          type: 'string',
          description: 'File path or glob pattern to watch'
        },
        events: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['add', 'change', 'unlink']
          },
          description: 'Events to watch for: add, change, unlink'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds to watch (default: 30000)'
        }
      },
      required: ['path_pattern']
    }
  },
  {
    name: 'find_files',
    description: 'Find files matching pattern with advanced options',
    schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files'
        },
        ignore_pattern: {
          type: 'string',
          description: 'Glob pattern to ignore'
        },
        max_depth: {
          type: 'number',
          description: 'Maximum directory depth to search'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'batch_process',
    description: 'Process multiple files with a text transformation',
    schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files'
        },
        search_text: {
          type: 'string',
          description: 'Text to search for'
        },
        replace_text: {
          type: 'string',
          description: 'Text to replace with'
        },
        regex: {
          type: 'boolean',
          description: 'Whether to use regex for search/replace'
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, show what would change without modifying files'
        }
      },
      required: ['pattern', 'search_text', 'replace_text']
    }
  }
];

// Utility function to search for files matching a pattern
async function findFiles(pattern, options = {}) {
  return new Promise((resolve, reject) => {
    const globOptions = {
      ignore: options.ignore_pattern,
      maxDepth: options.max_depth || undefined,
      nodir: true
    };
    
    glob(pattern, globOptions, (err, files) => {
      if (err) return reject(err);
      
      if (options.max_results && files.length > options.max_results) {
        files = files.slice(0, options.max_results);
      }
      
      resolve(files);
    });
  });
}

// Utility function to batch process files
async function batchProcessFiles(params) {
  const { pattern, search_text, replace_text, regex, dry_run } = params;
  
  try {
    const files = await findFiles(pattern);
    const results = [];
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        let searchPattern = search_text;
        
        if (regex) {
          // Extract regex pattern and flags from the search text (format: /pattern/flags)
          const regexMatch = search_text.match(/^\/(.*?)\/([gimuy]*)$/);
          if (regexMatch) {
            const [, pattern, flags] = regexMatch;
            searchPattern = new RegExp(pattern, flags);
          } else {
            searchPattern = new RegExp(search_text);
          }
        }
        
        const newContent = regex 
          ? content.replace(searchPattern, replace_text) 
          : content.split(search_text).join(replace_text);
        
        const changed = newContent !== content;
        
        if (changed) {
          if (!dry_run) {
            fs.writeFileSync(filePath, newContent, 'utf8');
          }
          
          results.push({
            file: filePath,
            changed: true,
            applied: !dry_run
          });
        }
      } catch (fileError) {
        results.push({
          file: filePath,
          error: fileError.message,
          changed: false
        });
      }
    }
    
    return {
      processed: results.length,
      changed: results.filter(r => r.changed).length,
      applied: results.filter(r => r.changed && r.applied).length,
      details: results
    };
  } catch (error) {
    throw new Error(`Batch processing failed: ${error.message}`);
  }
}

// Function to watch files and directories
function watchFiles(params) {
  return new Promise((resolve, reject) => {
    const { path_pattern, events, timeout } = params;
    
    try {
      const watcher = chokidar.watch(path_pattern, {
        persistent: true,
        ignoreInitial: true
      });
      
      const changes = [];
      const eventsToWatch = events || ['add', 'change', 'unlink'];
      
      eventsToWatch.forEach(event => {
        watcher.on(event, path => {
          changes.push({ event, path, time: new Date().toISOString() });
        });
      });
      
      // Set timeout to stop watching
      setTimeout(() => {
        watcher.close();
        resolve({
          watched: path_pattern,
          changes,
          duration_ms: timeout || 30000
        });
      }, timeout || 30000);
      
      // Handle errors
      watcher.on('error', error => {
        watcher.close();
        reject(new Error(`Watch error: ${error.message}`));
      });
    } catch (error) {
      reject(new Error(`Failed to set up file watcher: ${error.message}`));
    }
  });
}

// Main handler for file tool requests
async function handleFileTools(toolName, params) {
  try {
    switch (toolName) {
      case 'find_files': {
        const files = await findFiles(params.pattern, params);
        return {
          isError: false,
          content: [
            {
              type: 'text/plain',
              text: JSON.stringify({
                count: files.length,
                files: files
              }, null, 2)
            }
          ]
        };
      }
        
      case 'batch_process': {
        const result = await batchProcessFiles(params);
        return {
          isError: false,
          content: [
            {
              type: 'text/plain',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
        
      case 'watch_files': {
        const result = await watchFiles(params);
        return {
          isError: false,
          content: [
            {
              type: 'text/plain',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
        
      default:
        return {
          isError: true,
          content: [{ 
            type: 'text/plain', 
            text: `Unknown file tool: ${toolName}` 
          }]
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ 
        type: 'text/plain', 
        text: error.message 
      }]
    };
  }
}

module.exports = {
  fileTools,
  handleFileTools
}; 