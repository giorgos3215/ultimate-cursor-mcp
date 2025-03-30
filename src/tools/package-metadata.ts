import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  args?: string[];
  env?: string[];
  capabilities?: string[];
}

/**
 * Fetches metadata for a package, including auto-detected arguments and environment variables
 * @param packageName The name of the npm package or local path
 * @param isLocal Whether the package is a local path
 */
export async function fetchPackageMetadata(
  packageName: string,
  isLocal: boolean = false
): Promise<PackageMetadata> {
  try {
    let metadata: PackageMetadata = {
      name: packageName,
      version: '0.0.0',
    };
    
    if (isLocal) {
      return await fetchLocalPackageMetadata(packageName);
    } else {
      // Fetch from npm registry
      return await fetchNpmPackageMetadata(packageName);
    }
  } catch (error) {
    console.error('Error fetching package metadata:', error);
    throw error;
  }
}

/**
 * Fetches metadata for a local package
 * @param packagePath Path to the local package
 */
async function fetchLocalPackageMetadata(packagePath: string): Promise<PackageMetadata> {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      // If no package.json, might be a Python package
      return {
        name: path.basename(packagePath),
        version: '0.0.0',
      };
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const metadata: PackageMetadata = {
      name: packageJson.name || path.basename(packagePath),
      version: packageJson.version || '0.0.0',
      description: packageJson.description,
    };
    
    // Try to extract args and env from package.json
    if (packageJson.mcp) {
      if (packageJson.mcp.args) {
        metadata.args = Array.isArray(packageJson.mcp.args) ? 
          packageJson.mcp.args : 
          [packageJson.mcp.args];
      }
      
      if (packageJson.mcp.env) {
        metadata.env = Object.entries(packageJson.mcp.env).map(([key, value]) => `${key}=${value}`);
      }
      
      if (packageJson.mcp.capabilities) {
        metadata.capabilities = packageJson.mcp.capabilities;
      }
    }
    
    // If no args/env found in package.json, try to extract from README.md
    if (!metadata.args || !metadata.env) {
      await extractFromReadme(packagePath, metadata);
    }
    
    return metadata;
  } catch (error) {
    console.error('Error fetching local package metadata:', error);
    throw error;
  }
}

/**
 * Fetches metadata for a package from npm registry
 * @param packageName Name of the npm package
 */
async function fetchNpmPackageMetadata(packageName: string): Promise<PackageMetadata> {
  try {
    // Use npm view to get package info
    const npmViewOutput = await executeCommand(`npm view ${packageName} --json`);
    const packageInfo = JSON.parse(npmViewOutput);
    
    const metadata: PackageMetadata = {
      name: packageName,
      version: packageInfo.version || '0.0.0',
      description: packageInfo.description,
    };
    
    // Try to extract args and env from package.json
    if (packageInfo.mcp) {
      if (packageInfo.mcp.args) {
        metadata.args = Array.isArray(packageInfo.mcp.args) ? 
          packageInfo.mcp.args : 
          [packageInfo.mcp.args];
      }
      
      if (packageInfo.mcp.env) {
        metadata.env = Object.entries(packageInfo.mcp.env).map(([key, value]) => `${key}=${value}`);
      }
      
      if (packageInfo.mcp.capabilities) {
        metadata.capabilities = packageInfo.mcp.capabilities;
      }
    }
    
    // If no args/env found, try to extract from README.md
    if (!metadata.args || !metadata.env) {
      // We need to temporarily download the package to read its README
      const tempDir = await createTempDirectory();
      try {
        await executeCommand(`npm pack ${packageName} --quiet`, { cwd: tempDir });
        
        // Find the tarball
        const files = fs.readdirSync(tempDir);
        const tarball = files.find(file => file.endsWith('.tgz'));
        
        if (tarball) {
          // Extract the tarball
          await executeCommand(`tar -xzf ${tarball}`, { cwd: tempDir });
          
          // The package contents will be in a directory called 'package'
          const packageDir = path.join(tempDir, 'package');
          if (fs.existsSync(packageDir)) {
            await extractFromReadme(packageDir, metadata);
          }
        }
      } finally {
        // Clean up
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Failed to clean up temporary directory:', e);
        }
      }
    }
    
    return metadata;
  } catch (error) {
    console.error('Error fetching npm package metadata:', error);
    throw error;
  }
}

/**
 * Extract argument and environment variable information from README.md
 * @param packagePath Path to the package
 * @param metadata Metadata object to update
 */
async function extractFromReadme(packagePath: string, metadata: PackageMetadata): Promise<void> {
  const readmePaths = [
    path.join(packagePath, 'README.md'),
    path.join(packagePath, 'readme.md'),
    path.join(packagePath, 'README'),
    path.join(packagePath, 'README.markdown'),
  ];
  
  let readmeContent = '';
  
  // Find and read the README file
  for (const readmePath of readmePaths) {
    if (fs.existsSync(readmePath)) {
      readmeContent = fs.readFileSync(readmePath, 'utf-8');
      break;
    }
  }
  
  if (!readmeContent) {
    return;
  }
  
  // Extract arguments from README
  if (!metadata.args) {
    metadata.args = [];
    
    // Common patterns for arguments in READMEs
    const argPatterns = [
      /[Aa]rguments?\s*:?\s*["`']([^"'`]+)["`']/g,
      /--?([a-zA-Z0-9_-]+)/g,
      /parameters?\s*:?\s*["`']([^"'`]+)["`']/g,
      /[Oo]ptions?\s*:?\s*["`']([^"'`]+)["`']/g,
    ];
    
    for (const pattern of argPatterns) {
      let match;
      while ((match = pattern.exec(readmeContent)) !== null) {
        if (match[1] && !metadata.args.includes(match[1])) {
          metadata.args.push(match[1]);
        }
      }
    }
  }
  
  // Extract environment variables from README
  if (!metadata.env) {
    metadata.env = [];
    
    // Common patterns for environment variables in READMEs
    const envPatterns = [
      /\b([A-Z][A-Z0-9_]+)=([^\s]+)/g,
      /\b([A-Z][A-Z0-9_]+)=["']([^"']+)["']/g,
      /[Ee]nvironment variables?\s*:?\s*([A-Z][A-Z0-9_]+)/g,
      /[Ss]et\s+([A-Z][A-Z0-9_]+)=([^\s]+)/g,
    ];
    
    for (const pattern of envPatterns) {
      let match;
      while ((match = pattern.exec(readmeContent)) !== null) {
        const envVar = match[1];
        const envValue = match[2] || '';
        
        const envString = `${envVar}=${envValue}`;
        if (!metadata.env.find(e => e.startsWith(`${envVar}=`))) {
          metadata.env.push(envString);
        }
      }
    }
  }
}

/**
 * Create a temporary directory
 */
async function createTempDirectory(): Promise<string> {
  const tempDirBase = path.join(process.cwd(), '.tmp');
  
  if (!fs.existsSync(tempDirBase)) {
    fs.mkdirSync(tempDirBase, { recursive: true });
  }
  
  const tempDir = path.join(tempDirBase, `mcp-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  return tempDir;
}

/**
 * Execute a command and return the output
 */
async function executeCommand(
  command: string,
  options: childProcess.ExecOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.exec(
      command,
      options,
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

/**
 * Check if a package is MCP compliant
 * @param metadata Package metadata
 */
export function isMcpCompliant(metadata: PackageMetadata): { compliant: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for common MCP-related dependencies
  const hasMcpDependency = checkForMcpDependencies(metadata);
  if (!hasMcpDependency) {
    issues.push('No MCP SDK dependencies found');
  }
  
  // Check for capabilities
  if (!metadata.capabilities || metadata.capabilities.length === 0) {
    issues.push('No MCP capabilities defined');
  }
  
  // Final determination
  const compliant = issues.length === 0 || hasMcpDependency;
  
  return { compliant, issues };
}

/**
 * Check for common MCP SDK dependencies in metadata
 */
function checkForMcpDependencies(metadata: PackageMetadata): boolean {
  // We would need to have access to the package.json dependencies
  // For a more thorough check, this should be extended
  
  // If it has capabilities defined, it's likely using the MCP SDK
  if (metadata.capabilities && metadata.capabilities.length > 0) {
    return true;
  }
  
  // Common MCP SDK dependency names
  const mcpDependencyPatterns = [
    '@modelcontextprotocol/sdk',
    'mcp-sdk',
    'modelcontextprotocol',
    '@mcp/',
  ];
  
  // This is a simplification - ideally we'd check the actual dependencies
  if (metadata.name && mcpDependencyPatterns.some(pattern => metadata.name.includes(pattern))) {
    return true;
  }
  
  return false;
} 