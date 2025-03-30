/**
 * Code analysis tools for the Ultimate Self-Evolving Cursor MCP
 * Includes code search, dependency analysis, and linting
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const childProcess = require('child_process');

// Tool definitions
const codeTools = [
  {
    name: "code_search",
    description: "Search for code patterns or strings in files",
    schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The pattern to search for"
        },
        dir: {
          type: "string",
          description: "The directory to search in (default: current directory)"
        },
        filePattern: {
          type: "string",
          description: "Optional file pattern to limit search (e.g., '*.js')"
        },
        caseSensitive: {
          type: "boolean",
          description: "Whether the search is case-sensitive (default: false)"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 50)"
        }
      },
      required: ["pattern"]
    }
  },
  {
    name: "analyze_dependencies",
    description: "Analyze dependencies in a project",
    schema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "The path to the project directory (default: current directory)"
        },
        type: {
          type: "string",
          description: "The type of project (node, python, etc.)",
          enum: ["node", "python", "auto"]
        }
      }
    }
  },
  {
    name: "lint_code",
    description: "Lint code files for common issues",
    schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The path to the file to lint"
        },
        linter: {
          type: "string",
          description: "The linter to use (auto-detected from file extension if not specified)",
          enum: ["eslint", "pylint", "auto"]
        },
        fix: {
          type: "boolean",
          description: "Whether to automatically fix issues (default: false)"
        }
      },
      required: ["filePath"]
    }
  },
  {
    name: 'code_analyzer',
    description: 'Comprehensive code analysis tool with multiple capabilities',
    schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file or directory to analyze'
        },
        operation: {
          type: 'string',
          description: 'Analysis operation to perform',
          enum: ['complexity', 'dependencies', 'structure', 'security', 'quality']
        },
        options: {
          type: 'object',
          description: 'Additional options for the analysis',
          properties: {
            detail_level: {
              type: 'string',
              enum: ['basic', 'detailed', 'comprehensive'],
              default: 'detailed'
            },
            include_metrics: {
              type: 'boolean',
              default: true
            },
            max_issues: {
              type: 'number',
              default: 10
            }
          }
        }
      },
      required: ['file_path', 'operation']
    }
  },
  {
    name: 'smart_refactor',
    description: 'Intelligent code refactoring with architecture awareness',
    schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to refactor'
        },
        target: {
          type: 'string',
          description: 'Specific code element to refactor (function, class, etc.)'
        },
        refactoring_type: {
          type: 'string',
          description: 'Type of refactoring to perform',
          enum: ['extract_method', 'rename', 'optimize', 'modernize', 'split', 'cleanup']
        },
        new_name: {
          type: 'string',
          description: 'New name for renamed elements'
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, show changes without applying them',
          default: true
        }
      },
      required: ['file_path', 'refactoring_type']
    }
  },
  {
    name: 'project_insights',
    description: 'Generate insights about project structure, patterns, and architectural recommendations',
    schema: {
      type: 'object',
      properties: {
        project_dir: {
          type: 'string',
          description: 'Root directory of the project'
        },
        insight_type: {
          type: 'string',
          description: 'Type of insights to generate',
          enum: ['architecture', 'patterns', 'dependencies', 'issues', 'recommendations']
        },
        exclude_patterns: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Patterns to exclude from analysis',
          default: ['node_modules', '.git', 'dist', 'build']
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of insights to return',
          default: 10
        }
      },
      required: ['project_dir', 'insight_type']
    }
  }
];

// Search for code patterns or strings in files
async function searchCode(pattern, dir = '.', filePattern = '', caseSensitive = false, maxResults = 50) {
  return new Promise((resolve, reject) => {
    // Build the grep command
    let grepCommand = 'grep';
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // Use recursive search
      grepCommand += ' -r';
      
      // Add case insensitive flag if needed
      if (!caseSensitive) {
        grepCommand += ' -i';
      }
      
      // Add line numbers
      grepCommand += ' -n';
      
      // Limit to certain file patterns if specified
      if (filePattern) {
        grepCommand += ` --include="${filePattern}"`;
      }
      
      // Add the pattern and directory
      grepCommand += ` "${pattern.replace(/"/g, '\\"')}" ${dir}`;
      
      // Limit the number of results
      if (process.platform === 'linux') {
        grepCommand += ` | head -${maxResults}`;
      } else {
        // macOS version of head
        grepCommand += ` | head -n ${maxResults}`;
      }
    } else if (process.platform === 'win32') {
      // On Windows, we'd use findstr, but with limited functionality
      grepCommand = 'findstr /s';
      
      if (!caseSensitive) {
        grepCommand += ' /i';
      }
      
      grepCommand += ` /n "${pattern.replace(/"/g, '\\"')}" ${dir}\\*`;
      
      // Can't easily limit results on Windows with findstr alone
    } else {
      reject(new Error(`Unsupported platform: ${process.platform}`));
      return;
    }
    
    // Execute the command
    exec(grepCommand, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && error.code !== 1) {
        // grep returns 1 if no matches, which is not an error for us
        reject(new Error(`Search failed: ${stderr || error.message}`));
        return;
      }
      
      // Parse the results
      const results = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Parse the line (format: "file:line:content")
          const match = line.match(/^(.*?):(\d+):(.*)$/);
          if (match) {
            return {
              file: match[1],
              line: parseInt(match[2], 10),
              content: match[3].trim()
            };
          }
          return null;
        })
        .filter(Boolean);
      
      resolve(results);
    });
  });
}

// Analyze dependencies in a project
async function analyzeDependencies(projectPath = '.', type = 'auto') {
  return new Promise((resolve, reject) => {
    // Determine project type if auto
    if (type === 'auto') {
      if (fs.existsSync(path.join(projectPath, 'package.json'))) {
        type = 'node';
      } else if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || 
                fs.existsSync(path.join(projectPath, 'setup.py'))) {
        type = 'python';
      } else {
        reject(new Error('Could not determine project type. Please specify.'));
        return;
      }
    }
    
    let command;
    
    switch (type) {
      case 'node':
        command = 'npm list --json';
        break;
      case 'python':
        command = 'pip list --format=json';
        break;
      default:
        reject(new Error(`Unsupported project type: ${type}`));
        return;
    }
    
    // Execute the command
    exec(command, { cwd: projectPath, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Dependency analysis failed: ${stderr || error.message}`));
        return;
      }
      
      try {
        const dependencies = JSON.parse(stdout);
        resolve({ type, dependencies });
      } catch (e) {
        reject(new Error(`Failed to parse dependency information: ${e.message}`));
      }
    });
  });
}

// Lint code files for common issues
async function lintCode(filePath, linter = 'auto', fix = false) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }
    
    // Determine linter if auto
    if (linter === 'auto') {
      const ext = path.extname(filePath).toLowerCase();
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        linter = 'eslint';
      } else if (['.py'].includes(ext)) {
        linter = 'pylint';
      } else {
        reject(new Error(`Could not determine linter for file extension: ${ext}`));
        return;
      }
    }
    
    let command;
    
    switch (linter) {
      case 'eslint':
        command = `npx eslint "${filePath}"${fix ? ' --fix' : ''}`;
        break;
      case 'pylint':
        command = `pylint "${filePath}"`;
        break;
      default:
        reject(new Error(`Unsupported linter: ${linter}`));
        return;
    }
    
    // Execute the command
    exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      // Linters often exit with non-zero code when they find issues
      const output = stdout || stderr;
      
      resolve({
        filePath,
        linter,
        hasIssues: !!error,
        output: output.trim()
      });
    });
  });
}

// Helper function for file operations
function readCodeFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

// Helper to detect language from file extension
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'bash',
    '.swift': 'swift',
    '.kt': 'kotlin'
  };
  
  return languageMap[ext] || 'unknown';
}

// Helper to count lines of code
function countLinesOfCode(content) {
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  const codeLines = nonEmptyLines.filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.trim().startsWith('*'));
  const commentLines = nonEmptyLines.length - codeLines.length;
  
  return {
    total: lines.length,
    code: codeLines.length,
    comments: commentLines,
    blank: lines.length - nonEmptyLines.length,
    comment_ratio: commentLines / (nonEmptyLines.length || 1)
  };
}

// Analyze code complexity
function analyzeComplexity(content, language) {
  // Simple complexity analysis
  const functionMatchers = {
    'javascript': /function\s+\w+\s*\(|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*{/g,
    'python': /def\s+\w+\s*\(/g,
    'java': /(?:public|private|protected|static)?\s*\w+\s+\w+\s*\([^)]*\)\s*{/g
  };
  
  const conditionalMatchers = {
    'javascript': /if\s*\(|switch\s*\(|for\s*\(|while\s*\(/g,
    'python': /if\s+|elif\s+|for\s+|while\s+/g,
    'java': /if\s*\(|switch\s*\(|for\s*\(|while\s*\(/g
  };
  
  const matcher = functionMatchers[language] || functionMatchers['javascript'];
  const functions = (content.match(matcher) || []).length;
  
  const condMatcher = conditionalMatchers[language] || conditionalMatchers['javascript'];
  const conditionals = (content.match(condMatcher) || []).length;
  
  const nestedLevel = Math.min(
    (content.match(/{\s*{/g) || []).length,
    (content.match(/}\s*}/g) || []).length
  );
  
  return {
    functions: functions,
    conditionals: conditionals,
    nested_levels: nestedLevel,
    complexity_score: functions + conditionals + (nestedLevel * 2),
    risk_level: calculateRiskLevel(functions, conditionals, nestedLevel)
  };
}

// Calculate risk level based on complexity metrics
function calculateRiskLevel(functions, conditionals, nestedLevel) {
  const score = functions + conditionals + (nestedLevel * 2);
  if (score < 10) return 'low';
  if (score < 20) return 'medium';
  return 'high';
}

// Analyze dependencies
function analyzeDependencies(filePath, content, language) {
  // Extract imports/requires based on language
  let dependencies = [];
  
  if (language === 'javascript' || language === 'typescript') {
    // Extract ES6 imports
    const es6Imports = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
    const es6Dependencies = es6Imports.map(imp => {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    // Extract CommonJS requires
    const cjsImports = content.match(/(?:const|let|var)\s+.*?require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
    const cjsDepencies = cjsImports.map(imp => {
      const match = imp.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    dependencies = [...es6Dependencies, ...cjsDepencies];
  } else if (language === 'python') {
    // Extract Python imports
    const importLines = content.match(/^(?:import|from)\s+[^;]+/gm) || [];
    dependencies = importLines.map(line => {
      if (line.startsWith('import ')) {
        return line.replace('import ', '').split(',')[0].trim();
      } else if (line.startsWith('from ')) {
        const parts = line.match(/from\s+([^\s]+)\s+import/);
        return parts ? parts[1] : null;
      }
      return null;
    }).filter(Boolean);
  }
  
  return {
    count: dependencies.length,
    items: dependencies,
    external: dependencies.filter(d => !d.startsWith('.')).length,
    internal: dependencies.filter(d => d.startsWith('.')).length
  };
}

// Analyze code structure
function analyzeStructure(content, language) {
  let classes = 0;
  let functions = 0;
  let interfaces = 0;
  
  if (language === 'javascript' || language === 'typescript') {
    classes = (content.match(/class\s+\w+/g) || []).length;
    functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*{/g) || []).length;
    
    if (language === 'typescript') {
      interfaces = (content.match(/interface\s+\w+/g) || []).length;
    }
  } else if (language === 'python') {
    classes = (content.match(/class\s+\w+/g) || []).length;
    functions = (content.match(/def\s+\w+/g) || []).length;
  }
  
  return {
    classes,
    functions,
    interfaces,
    file_size_bytes: content.length,
    average_function_size: content.length / (functions || 1)
  };
}

// Analyze code quality and issues
function analyzeQuality(content, language) {
  const issues = [];
  
  // Check for common code smells
  if (language === 'javascript' || language === 'typescript') {
    // Magic numbers
    const magicNumbers = content.match(/[^0-9][0-9]{4,}[^0-9]/g) || [];
    if (magicNumbers.length > 0) {
      issues.push({
        type: 'magic_number',
        description: 'Magic numbers detected in code',
        count: magicNumbers.length
      });
    }
    
    // Long functions
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}/g) || [];
    const longFunctions = functionMatches.filter(fn => fn.split('\n').length > 30);
    if (longFunctions.length > 0) {
      issues.push({
        type: 'long_function',
        description: 'Functions with excessive length',
        count: longFunctions.length
      });
    }
    
    // Nested callbacks (callback hell)
    const nestedCallbacks = content.match(/\)\s*{\s*[^\n]*\(\s*function\s*\(/g) || [];
    if (nestedCallbacks.length > 1) {
      issues.push({
        type: 'callback_hell',
        description: 'Nested callbacks detected (callback hell)',
        count: nestedCallbacks.length
      });
    }
  }
  
  // Common issues across languages
  // Commented-out code
  const commentedCode = content.match(/\/\/.*(if|function|for|while|return)/g) || [];
  if (commentedCode.length > 5) {
    issues.push({
      type: 'commented_code',
      description: 'Significant amount of commented-out code',
      count: commentedCode.length
    });
  }
  
  // TODO comments
  const todos = content.match(/\/\/\s*TODO|\/\*\s*TODO/g) || [];
  if (todos.length > 0) {
    issues.push({
      type: 'todo',
      description: 'TODO comments found',
      count: todos.length,
      recommendation: 'Consider addressing TODOs or converting to tracked issues'
    });
  }
  
  return {
    issues_count: issues.length,
    issues: issues,
    quality_score: Math.max(10 - issues.length, 1)
  };
}

// Simple security analysis
function analyzeSecurityIssues(content, language) {
  const issues = [];
  
  // Check for common security issues
  if (language === 'javascript' || language === 'typescript') {
    // Potential eval usage
    const evalUsage = content.match(/eval\s*\(/g) || [];
    if (evalUsage.length > 0) {
      issues.push({
        type: 'eval_usage',
        severity: 'high',
        description: 'Use of eval() detected, which can lead to code injection vulnerabilities',
        count: evalUsage.length
      });
    }
    
    // Hardcoded credentials
    const hardcodedSecrets = content.match(/(?:password|token|key|secret|apiKey)\s*=\s*['"][^'"]{8,}['"]/gi) || [];
    if (hardcodedSecrets.length > 0) {
      issues.push({
        type: 'hardcoded_secrets',
        severity: 'high',
        description: 'Potential hardcoded credentials or secrets detected',
        count: hardcodedSecrets.length
      });
    }
    
    // Insecure random
    const insecureRandom = content.match(/Math\.random\s*\(/g) || [];
    if (insecureRandom.length > 0) {
      issues.push({
        type: 'insecure_random',
        severity: 'medium',
        description: 'Use of Math.random() for potentially security-sensitive operations',
        count: insecureRandom.length
      });
    }
  } else if (language === 'python') {
    // Potential eval usage
    const evalUsage = content.match(/eval\s*\(/g) || [];
    if (evalUsage.length > 0) {
      issues.push({
        type: 'eval_usage',
        severity: 'high',
        description: 'Use of eval() detected, which can lead to code injection vulnerabilities',
        count: evalUsage.length
      });
    }
    
    // Hardcoded credentials
    const hardcodedSecrets = content.match(/(?:password|token|key|secret|api_key)\s*=\s*['"][^'"]{8,}['"]/gi) || [];
    if (hardcodedSecrets.length > 0) {
      issues.push({
        type: 'hardcoded_secrets',
        severity: 'high',
        description: 'Potential hardcoded credentials or secrets detected',
        count: hardcodedSecrets.length
      });
    }
  }
  
  return {
    issues_count: issues.length,
    issues: issues,
    risk_rating: issues.length > 0 ? (
      issues.some(i => i.severity === 'high') ? 'high' : 'medium'
    ) : 'low',
    recommended_actions: generateSecurityRecommendations(issues)
  };
}

// Generate security recommendations
function generateSecurityRecommendations(issues) {
  const recommendations = [];
  
  issues.forEach(issue => {
    if (issue.type === 'eval_usage') {
      recommendations.push('Replace eval() with safer alternatives like JSON.parse for JSON data or Function constructors if necessary');
    } else if (issue.type === 'hardcoded_secrets') {
      recommendations.push('Move credentials to environment variables or a secure vault solution');
    } else if (issue.type === 'insecure_random') {
      recommendations.push('Use cryptographically secure random number generation for security-sensitive operations');
    }
  });
  
  return recommendations;
}

// Main handler for code analyzer tool
async function handleCodeAnalyzer(params) {
  const { file_path, operation, options = {} } = params;
  const detail_level = options.detail_level || 'detailed';
  
  try {
    // Check if file exists
    if (!fs.existsSync(file_path)) {
      return {
        isError: true,
        content: [{ 
          type: 'text/plain', 
          text: `File or directory does not exist: ${file_path}` 
        }]
      };
    }
    
    const stats = fs.statSync(file_path);
    let result = {};
    
    if (stats.isFile()) {
      // Analyze a single file
      const content = readCodeFile(file_path);
      const language = detectLanguage(file_path);
      
      switch (operation) {
        case 'complexity':
          result = {
            file_path,
            language,
            lines: countLinesOfCode(content),
            complexity: analyzeComplexity(content, language)
          };
          break;
          
        case 'dependencies':
          result = {
            file_path,
            language,
            dependencies: analyzeDependencies(file_path, content, language)
          };
          break;
          
        case 'structure':
          result = {
            file_path,
            language,
            structure: analyzeStructure(content, language)
          };
          break;
          
        case 'security':
          result = {
            file_path,
            language,
            security: analyzeSecurityIssues(content, language)
          };
          break;
          
        case 'quality':
          result = {
            file_path,
            language,
            quality: analyzeQuality(content, language)
          };
          break;
          
        default:
          return {
            isError: true,
            content: [{ 
              type: 'text/plain', 
              text: `Unknown operation: ${operation}` 
            }]
          };
      }
    } else if (stats.isDirectory()) {
      // Directory analysis is more complex and depends on the operation
      // For now, we'll just return a simple message
      return {
        isError: false,
        content: [{ 
          type: 'text/plain', 
          text: `Directory analysis for '${operation}' is not fully implemented yet. Please specify a file path for detailed analysis.` 
        }]
      };
    }
    
    // Adjust result detail level
    if (detail_level === 'basic') {
      // Simplify the result for basic view
      Object.keys(result).forEach(key => {
        if (typeof result[key] === 'object' && result[key] !== null) {
          const obj = result[key];
          // Keep only count properties and scores
          Object.keys(obj).forEach(subKey => {
            if (subKey.includes('score') || subKey.includes('count') || subKey === 'risk_level' || subKey === 'risk_rating') {
              // Keep these properties
            } else if (Array.isArray(obj[subKey]) && obj[subKey].length > 3) {
              obj[subKey] = obj[subKey].slice(0, 3);
            } else if (typeof obj[subKey] === 'object' && obj[subKey] !== null) {
              delete obj[subKey];
            }
          });
        }
      });
    }
    
    // Convert result to JSON string
    const resultJson = JSON.stringify(result, null, 2);
    
    return {
      isError: false,
      content: [{ 
        type: 'text/plain', 
        text: resultJson
      }]
    };
    
  } catch (error) {
    return {
      isError: true,
      content: [{ 
        type: 'text/plain', 
        text: `Error analyzing code: ${error.message}` 
      }]
    };
  }
}

// Placeholder for smart refactor handler
async function handleSmartRefactor(params) {
  return {
    isError: false,
    content: [{ 
      type: 'text/plain', 
      text: `Smart refactoring capability is coming soon. Params received: ${JSON.stringify(params)}` 
    }]
  };
}

// Placeholder for project insights handler
async function handleProjectInsights(params) {
  return {
    isError: false,
    content: [{ 
      type: 'text/plain', 
      text: `Project insights capability is coming soon. Params received: ${JSON.stringify(params)}` 
    }]
  };
}

// Main handler for code tools
async function handleCodeTools(toolName, params) {
  try {
    switch (toolName) {
      case 'code_analyzer':
        return await handleCodeAnalyzer(params);
        
      case 'smart_refactor':
        return await handleSmartRefactor(params);
        
      case 'project_insights':
        return await handleProjectInsights(params);
        
      case "code_search": {
        const { 
          pattern, 
          dir = '.', 
          filePattern = '', 
          caseSensitive = false, 
          maxResults = 50 
        } = params;
        
        if (!pattern) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Search pattern is required"
              }
            ]
          };
        }
        
        try {
          const results = await searchCode(pattern, dir, filePattern, caseSensitive, maxResults);
          
          if (results.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No matches found for pattern: "${pattern}"`
                }
              ]
            };
          }
          
          const formattedResults = results.map(result => 
            `${result.file}:${result.line}: ${result.content}`
          ).join('\n');
          
          return {
            content: [
              {
                type: "text",
                text: `Search results for pattern "${pattern}":\n\n${formattedResults}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Code search failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "analyze_dependencies": {
        const { projectPath = '.', type = 'auto' } = params;
        
        try {
          const analysis = await analyzeDependencies(projectPath, type);
          
          let formattedDependencies;
          
          if (analysis.type === 'node') {
            // Format npm dependencies
            const deps = analysis.dependencies.dependencies || {};
            formattedDependencies = Object.entries(deps)
              .map(([name, info]) => `${name}: ${info.version || 'unknown'}${info.problems ? ' (has issues)' : ''}`)
              .join('\n');
          } else if (analysis.type === 'python') {
            // Format pip dependencies
            formattedDependencies = analysis.dependencies
              .map(dep => `${dep.name}: ${dep.version}`)
              .join('\n');
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Dependency analysis for ${analysis.type} project:\n\n${formattedDependencies}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Dependency analysis failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "lint_code": {
        const { filePath, linter = 'auto', fix = false } = params;
        
        if (!filePath) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "File path is required"
              }
            ]
          };
        }
        
        try {
          const lintResult = await lintCode(filePath, linter, fix);
          
          if (!lintResult.hasIssues) {
            return {
              content: [
                {
                  type: "text",
                  text: `No linting issues found in ${filePath}`
                }
              ]
            };
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Linting issues found in ${filePath}:\n\n${lintResult.output}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Linting failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      default:
        return {
          isError: true,
          content: [{ 
            type: 'text/plain', 
            text: `Unknown code tool: ${toolName}` 
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
  codeTools,
  handleCodeTools
}; 