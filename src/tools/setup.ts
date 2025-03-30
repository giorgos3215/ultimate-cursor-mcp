import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fetchPackageMetadata, isMcpCompliant } from './package-metadata';

interface SetupInput {
  action: 'install' | 'verify' | 'configure' | 'uninstall';
  package_name?: string;
  path?: string;
  args?: string[];
  env?: string[];
}

interface SetupResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Create a function to handle the setup tool
 */
export function createSetupTool() {
  return async (input: SetupInput): Promise<SetupResponse> => {
    const { action } = input;
    
    try {
      switch (action) {
        case 'install':
          if (input.package_name) {
            return await installPackage(input.package_name, input.args, input.env);
          } else if (input.path) {
            return await installLocal(input.path, input.args, input.env);
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Error: Installation requires either package_name or path',
                },
              ],
            };
          }
        
        case 'verify':
          return await verifyInstallation();
          
        case 'configure':
          return await configureMCP(input.env);
          
        case 'uninstall':
          return await uninstallMCP(input.package_name);
          
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown action: ${action}`,
              },
            ],
          };
      }
    } catch (error) {
      console.error('Error in setup tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error during setup: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };
}

/**
 * Install an MCP package
 */
async function installPackage(
  packageName: string,
  args: string[] = [],
  env: string[] = []
): Promise<SetupResponse> {
  try {
    // First check if Node.js is available
    if (!await hasNodeJs()) {
      return {
        content: [
          {
            type: 'text',
            text: 'Node.js is not installed. Please install Node.js to continue.',
          },
        ],
      };
    }

    // Get package metadata with auto-detected args and env
    const metadata = await fetchPackageMetadata(packageName, false);
    
    // Check if MCP compliant
    const compliance = isMcpCompliant(metadata);
    if (!compliance.compliant) {
      const warningMessage = `Warning: The package ${packageName} might not be MCP compliant.\nIssues found:\n- ${compliance.issues.join('\n- ')}\n\nInstalling anyway...`;
      console.warn(warningMessage);
      
      return {
        content: [
          {
            type: 'text',
            text: warningMessage,
          },
        ],
      };
    }
    
    // Merge provided args with auto-detected args (prioritize user-provided args)
    const mergedArgs = args.length > 0 ? args : (metadata.args || []);
    
    // Merge provided env with auto-detected env (prioritize user-provided env)
    const mergedEnv: string[] = [...(metadata.env || [])];
    
    // Add user-provided env variables, potentially overriding auto-detected ones
    if (env.length > 0) {
      for (const envVar of env) {
        const [key] = envVar.split('=');
        // Remove any existing env var with the same key
        const index = mergedEnv.findIndex(e => e.startsWith(`${key}=`));
        if (index !== -1) {
          mergedEnv.splice(index, 1);
        }
        // Add the user-provided env var
        mergedEnv.push(envVar);
      }
    }

    // Check if it's an npm package
    const isNpm = await isNpmPackage(packageName);
    if (isNpm) {
      // Install via npx
      const envVars = mergedEnv.length > 0 ? mergedEnv.map(e => e.split('=')).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>) : {};
      
      const argsStr = mergedArgs.length > 0 ? mergedArgs.join(' ') : '';
      
      // Create the installation command
      const cmd = `npx -y ${packageName} ${argsStr}`;
      
      // Run the command
      const result = await executeCommand(cmd, envVars);
      
      // Install to Cursor config
      await installToCursor(packageName, mergedArgs, mergedEnv);
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully installed and configured ${packageName} for Cursor!\n\n${result}`,
          },
        ],
      };
    } else {
      // Try as Python package if not npm
      if (await hasUvx()) {
        const envStr = mergedEnv.length > 0 ? mergedEnv.join(' ') : '';
        const argsStr = mergedArgs.length > 0 ? mergedArgs.join(' ') : '';
        
        // Create the installation command
        const cmd = `uvx ${packageName} ${argsStr}`;
        
        // Run the command
        const result = await executeCommand(cmd, mergedEnv.reduce((acc, e) => {
          const [key, value] = e.split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>));
        
        // Install to Cursor config
        await installToCursor(packageName, mergedArgs, mergedEnv, false);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully installed and configured ${packageName} for Cursor!\n\n${result}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'Python uv is not installed. Please install it to continue with Python packages.',
            },
          ],
        };
      }
    }
  } catch (error) {
    console.error('Error installing package:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to install package: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Install a local MCP server
 */
async function installLocal(
  localPath: string,
  args: string[] = [],
  env: string[] = []
): Promise<SetupResponse> {
  try {
    // Check if the path exists
    if (!fs.existsSync(localPath)) {
      return {
        content: [
          {
            type: 'text',
            text: `The path ${localPath} does not exist.`,
          },
        ],
      };
    }

    // Get package metadata with auto-detected args and env
    const metadata = await fetchPackageMetadata(localPath, true);
    
    // Check if MCP compliant
    const compliance = isMcpCompliant(metadata);
    if (!compliance.compliant) {
      const warningMessage = `Warning: The package at ${localPath} might not be MCP compliant.\nIssues found:\n- ${compliance.issues.join('\n- ')}\n\nInstalling anyway...`;
      console.warn(warningMessage);
      
      return {
        content: [
          {
            type: 'text',
            text: warningMessage,
          },
        ],
      };
    }
    
    // Merge provided args with auto-detected args (prioritize user-provided args)
    const mergedArgs = args.length > 0 ? args : (metadata.args || []);
    
    // Merge provided env with auto-detected env (prioritize user-provided env)
    const mergedEnv: string[] = [...(metadata.env || [])];
    
    // Add user-provided env variables, potentially overriding auto-detected ones
    if (env.length > 0) {
      for (const envVar of env) {
        const [key] = envVar.split('=');
        // Remove any existing env var with the same key
        const index = mergedEnv.findIndex(e => e.startsWith(`${key}=`));
        if (index !== -1) {
          mergedEnv.splice(index, 1);
        }
        // Add the user-provided env var
        mergedEnv.push(envVar);
      }
    }
    
    // Determine if it's a Node.js or Python project
    const hasPackageJson = fs.existsSync(path.join(localPath, 'package.json'));
    const hasPythonFiles = fs.existsSync(path.join(localPath, 'setup.py')) || 
                          fs.existsSync(path.join(localPath, 'pyproject.toml'));
    
    let serverName = metadata.name;
    let isNodeJs = hasPackageJson;
    
    // Install to Cursor config
    await installToCursor(serverName, mergedArgs, mergedEnv, isNodeJs, localPath);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully installed local MCP server ${serverName} from ${localPath}${
            mergedArgs.length > 0 ? `\nDetected arguments: ${mergedArgs.join(' ')}` : ''
          }${
            mergedEnv.length > 0 ? `\nDetected environment variables: ${mergedEnv.join(', ')}` : ''
          }`,
        },
      ],
    };
  } catch (error) {
    console.error('Error installing local server:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to install local server: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Verify MCP installation
 */
async function verifyInstallation(): Promise<SetupResponse> {
  try {
    // Check if Cursor config exists
    const configPath = getCursorConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Cursor MCP configuration not found.',
          },
        ],
      };
    }
    
    // Read the config
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    let config: any;
    
    try {
      config = JSON.parse(configRaw);
    } catch (e) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to parse Cursor MCP configuration.',
          },
        ],
      };
    }
    
    // Check if our MCP is installed
    if (!config.servers) {
      return {
        content: [
          {
            type: 'text',
            text: 'No MCP servers configured in Cursor.',
          },
        ],
      };
    }
    
    // List installed servers
    const servers = Object.keys(config.servers).map(key => {
      const server = config.servers[key];
      return `- ${server.name} (${key})${server.path ? ` at ${server.path}` : ''}`;
    });
    
    if (servers.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No MCP servers configured in Cursor.',
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${servers.length} MCP server(s) configured in Cursor:\n\n${servers.join('\n')}`,
        },
      ],
    };
  } catch (error) {
    console.error('Error verifying installation:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to verify installation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Configure the MCP
 */
async function configureMCP(env: string[] = []): Promise<SetupResponse> {
  try {
    // Create .env file if it doesn't exist
    const envPath = path.join(process.cwd(), '.env');
    
    // Prepare env content
    let envContent = '';
    
    // Read existing .env if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Add new env variables
    if (env && env.length > 0) {
      for (const envVar of env) {
        const [key, value] = envVar.split('=');
        
        // Check if the key already exists
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
          // Replace existing value
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          // Add new value
          envContent += `\n${key}=${value}`;
        }
      }
      
      // Clean up extra newlines
      envContent = envContent.trim() + '\n';
      
      // Write the .env file
      fs.writeFileSync(envPath, envContent);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: 'Successfully configured MCP environment variables.',
        },
      ],
    };
  } catch (error) {
    console.error('Error configuring MCP:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to configure MCP: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Uninstall an MCP server
 */
async function uninstallMCP(packageName?: string): Promise<SetupResponse> {
  try {
    // Get Cursor config path
    const configPath = getCursorConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Cursor MCP configuration not found.',
          },
        ],
      };
    }
    
    // Read the config
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    let config: any;
    
    try {
      config = JSON.parse(configRaw);
    } catch (e) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to parse Cursor MCP configuration.',
          },
        ],
      };
    }
    
    // If no package name specified, list available packages
    if (!packageName) {
      const servers = Object.keys(config.servers || {}).map(key => {
        const server = config.servers[key];
        return `- ${server.name} (${key})`;
      });
      
      if (servers.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No MCP servers configured in Cursor to uninstall.',
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Please specify one of the following MCP servers to uninstall:\n\n${servers.join('\n')}`,
          },
        ],
      };
    }
    
    // Find the server by name or key
    let serverKey: string | null = null;
    
    if (config.servers) {
      // First try exact key match
      if (config.servers[packageName]) {
        serverKey = packageName;
      } else {
        // Try matching by name
        for (const key in config.servers) {
          if (config.servers[key].name === packageName) {
            serverKey = key;
            break;
          }
        }
      }
    }
    
    if (!serverKey) {
      return {
        content: [
          {
            type: 'text',
            text: `MCP server "${packageName}" not found in Cursor configuration.`,
          },
        ],
      };
    }
    
    // Remove the server
    delete config.servers[serverKey];
    
    // Write the updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully uninstalled MCP server "${packageName}" from Cursor.`,
        },
      ],
    };
  } catch (error) {
    console.error('Error uninstalling MCP:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to uninstall MCP: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Install an MCP server to Cursor configuration
 */
async function installToCursor(
  name: string,
  args: string[] = [],
  env: string[] = [],
  isNodeJs: boolean = true,
  localPath?: string
): Promise<void> {
  // Get Cursor config path
  const configPath = getCursorConfigPath();
  
  // Create directory if it doesn't exist
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Read existing config or create new one
  let config: any = { servers: {} };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.servers) {
        config.servers = {};
      }
    } catch (e) {
      console.warn('Failed to parse existing Cursor config, creating new one');
    }
  }
  
  // Create a unique key for the server
  const serverKey = name.replace(/[@/]/g, '-');
  
  // Prepare server configuration
  const serverConfig: any = {
    name,
    type: isNodeJs ? 'node' : 'python',
  };
  
  // Add args if provided
  if (args && args.length > 0) {
    serverConfig.args = args;
  }
  
  // Add env if provided
  if (env && env.length > 0) {
    serverConfig.env = {};
    for (const envVar of env) {
      const [key, value] = envVar.split('=');
      serverConfig.env[key] = value;
    }
  }
  
  // Add path if local
  if (localPath) {
    serverConfig.path = localPath;
  }
  
  // Add to config
  config.servers[serverKey] = serverConfig;
  
  // Write config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Get the path to the Cursor MCP configuration file
 */
function getCursorConfigPath(): string {
  const homeDir = os.homedir();
  
  if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Roaming', 'cursor', 'mcp.json');
  } else if (process.platform === 'darwin') {
    return path.join(homeDir, '.cursor', 'mcp.json');
  } else {
    // Linux
    return path.join(homeDir, '.config', 'cursor', 'mcp.json');
  }
}

/**
 * Execute a command and return the output
 */
async function executeCommand(
  command: string,
  env: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = childProcess.exec(
      command,
      {
        env: { ...process.env, ...env },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

/**
 * Check if Node.js is available
 */
async function hasNodeJs(): Promise<boolean> {
  try {
    await executeCommand('node --version');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if uvx is available
 */
async function hasUvx(): Promise<boolean> {
  try {
    await executeCommand('uvx --version');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a package exists on npm
 */
async function isNpmPackage(name: string): Promise<boolean> {
  try {
    await executeCommand(`npm view ${name} version`);
    return true;
  } catch (e) {
    return false;
  }
} 