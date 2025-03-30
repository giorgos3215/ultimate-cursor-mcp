#!/usr/bin/env python3

import argparse
import json
import os
import sys
import time
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

def get_config_path() -> Path:
    """Get the path to the Cursor MCP configuration file."""
    if sys.platform == "win32":
        config_path = Path(os.path.expanduser("~")) / ".cursor" / "mcp.json"
    else:
        config_path = Path(os.path.expanduser("~")) / ".cursor" / "mcp.json"
    return config_path

def load_config() -> Dict:
    """Load the MCP configuration file or create if it doesn't exist."""
    config_path = get_config_path()
    if not config_path.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        return {"mcpServers": {}}
    
    with open(config_path, 'r') as f:
        return json.load(f)

def save_config(config: Dict) -> None:
    """Save the MCP configuration to file."""
    config_path = get_config_path()
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

def check_environment() -> Dict[str, bool]:
    """Check if required tools are available."""
    env_status = {
        "node": False,
        "npm": False,
        "uvx": False
    }
    
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
        env_status["node"] = True
        logger.info("Node.js is available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("Node.js is not available")

    try:
        subprocess.run(["npm", "--version"], capture_output=True, check=True)
        env_status["npm"] = True
        logger.info("npm is available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("npm is not available")
        
    try:
        subprocess.run(["uvx", "--version"], capture_output=True, check=True)
        env_status["uvx"] = True
        logger.info("uvx is available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("uvx is not available")
        
    return env_status

def check_package_json(path: str) -> Dict:
    """Read and validate package.json file."""
    try:
        with open(os.path.join(path, 'package.json'), 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"package.json not found in {path}")
        return {}
    except json.JSONDecodeError:
        logger.error(f"Invalid package.json in {path}")
        return {}

def is_mcp_compliant(package_name: str, local_path: Optional[str] = None, max_retries: int = 3) -> bool:
    """
    Check if a package is MCP-compliant by examining its package.json.
    
    Args:
        package_name (str): Name of the package to check
        local_path (str, optional): Path to local package
        max_retries (int): Maximum number of retry attempts
    """
    for attempt in range(max_retries):
        try:
            logger.info(f"Checking MCP compliance for {package_name} (attempt {attempt + 1}/{max_retries})")
            
            if local_path:
                package_info = check_package_json(local_path)
            else:
                # Use npm view to get package.json content
                result = subprocess.run(
                    ["npm", "view", package_name, "--json"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                package_info = json.loads(result.stdout)
            
            # Check for MCP compliance indicators
            has_mcp_deps = any(
                dep.startswith("@modelcontextprotocol/")
                for dep in package_info.get("dependencies", {}).keys()
            )
            
            has_mcp_schema = "modelcontextprotocol" in str(package_info)
            
            # Check for MCP-specific fields
            has_mcp_fields = (
                "capabilities" in package_info and
                "tools" in package_info.get("capabilities", {})
            )
            
            is_compliant = has_mcp_deps or has_mcp_schema or has_mcp_fields
            
            if is_compliant:
                logger.info(f"Package {package_name} is MCP-compliant")
            else:
                logger.warning(f"Package {package_name} is not MCP-compliant")
                
            return is_compliant
            
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
            if attempt < max_retries - 1:
                logger.info("Waiting 1 second before retry...")
                time.sleep(1)
            else:
                logger.error(f"All {max_retries} attempts failed")
                return False

def generate_smithery_yaml(
    package_name: str, 
    command: str, 
    args: Optional[List[str]] = None, 
    env: Optional[Dict[str, str]] = None
) -> bool:
    """
    Generate a smithery.yaml file for publishing on smithery.ai
    
    Args:
        package_name (str): Name of the package
        command (str): Command to run the MCP server
        args (List[str], optional): Arguments for the server
        env (Dict[str, str], optional): Environment variables
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        logger.info(f"Generating smithery.yaml for {package_name}")
        
        # Create basic smithery configuration
        smithery_config = {
            "startCommand": {
                "type": "stdio"
            },
            "configSchema": {
                "type": "object",
                "properties": {}
            },
            "commandFunction": f"(config) => {{ command: '{command}', args: {json.dumps(args or [])} }}"
        }
        
        # Add environment variables to the config schema if provided
        if env:
            for key, value in env.items():
                smithery_config["configSchema"]["properties"][key] = {
                    "type": "string",
                    "description": f"Environment variable: {key}"
                }
            
            # Mark required env variables
            smithery_config["configSchema"]["required"] = list(env.keys())
        
        # Add example config
        smithery_config["exampleConfig"] = {}
        
        # Write the smithery.yaml file
        with open("smithery.yaml", 'w') as f:
            f.write("# Smithery configuration file: https://smithery.ai/docs/config#smitheryyaml\n")
            for key, value in smithery_config.items():
                if key == "commandFunction":
                    f.write(f"{key}:\n")
                    f.write("# A JS function that produces the CLI command based on the given config to start the MCP on stdio.\n")
                    f.write("|-\n")
                    f.write(value + "\n")
                else:
                    f.write(f"{key}:\n")
                    if key == "configSchema":
                        f.write("# JSON Schema defining the configuration options for the MCP.\n")
                    yaml_value = json.dumps(value, indent=2).replace('{', '{\n').replace('}', '\n}').replace(',', ',\n')
                    for line in yaml_value.split('\n'):
                        f.write(f"  {line}\n")
        
        logger.info(f"Successfully generated smithery.yaml for {package_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to generate smithery.yaml: {str(e)}")
        return False

def install_local_mcp_server(
    path: str,
    args: Optional[List[str]] = None,
    env: Optional[Dict[str, str]] = None,
    max_retries: int = 3
) -> bool:
    """
    Install a local MCP server.
    
    Args:
        path (str): Path to the local MCP server code
        args (List[str], optional): Additional arguments for the server
        env (Dict[str, str], optional): Environment variables
        max_retries (int): Maximum number of retry attempts
    """
    try:
        logger.info(f"Installing local MCP server from {path}")
        
        # Check if path exists
        if not os.path.exists(path):
            logger.error(f"Path does not exist: {path}")
            return False
            
        # Verify MCP compliance
        if not is_mcp_compliant(os.path.basename(path), local_path=path):
            logger.error(f"Local package at {path} is not MCP-compliant")
            return False
        
        # Load current config
        config = load_config()
        
        # Get package name from package.json
        package_info = check_package_json(path)
        name = package_info.get("name", os.path.basename(path))
        
        # Prepare server configuration
        server_config = {
            "command": "node",
            "args": [os.path.join(path, "index.js")] + (args if args else []),
            "type": "stdio"
        }
        
        if env:
            server_config["env"] = env
        
        # Update config
        config["mcpServers"][name] = server_config
        save_config(config)
        
        # Generate smithery.yaml for publishing on smithery.ai
        generate_smithery_yaml(name, "node", [os.path.join(path, "index.js")] + (args if args else []), env)
        
        logger.info(f"Successfully installed local MCP server: {name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to install local MCP server: {str(e)}")
        return False

def install_mcp_server(
    name: str,
    args: Optional[List[str]] = None,
    env: Optional[Dict[str, str]] = None,
    max_retries: int = 3
) -> bool:
    """
    Install an MCP server and update the configuration.
    
    Args:
        name (str): Name of the package to install
        args (List[str], optional): Additional arguments for the server
        env (Dict[str, str], optional): Environment variables
        max_retries (int): Maximum number of retry attempts
    """
    for attempt in range(max_retries):
        try:
            logger.info(f"Installing MCP server {name} (attempt {attempt + 1}/{max_retries})")
            
            # Check environment
            env_status = check_environment()
            if not env_status["node"] or not env_status["npm"]:
                logger.error("Node.js and npm are required")
                return False
                
            # Verify MCP compliance
            if not is_mcp_compliant(name):
                logger.error(f"Package {name} is not MCP-compliant")
                return False
            
            # Load current config
            config = load_config()
            
            # Prepare server configuration
            server_config = {
                "command": "npx" if env_status["npm"] else "uvx",
                "args": ["-y", name] + (args if args else []),
                "type": "stdio"
            }
            
            if env:
                server_config["env"] = env
            
            # Update config
            config["mcpServers"][name] = server_config
            save_config(config)
            
            # Generate smithery.yaml for publishing on smithery.ai
            cmd = "npx" if env_status["npm"] else "uvx"
            generate_smithery_yaml(name, cmd, ["-y", name] + (args if args else []), env)
            
            logger.info(f"Successfully installed MCP server: {name}")
            return True
            
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
            if attempt < max_retries - 1:
                logger.info("Waiting 1 second before retry...")
                time.sleep(1)
            else:
                logger.error(f"All {max_retries} attempts failed")
                return False

def fetch_package_metadata(url: str) -> Dict:
    """
    Fetch package metadata from a URL (GitHub repository, npm package, etc.)
    to automatically determine required args and env variables.
    
    Args:
        url (str): URL to fetch metadata from
        
    Returns:
        Dict: Package metadata with args and env variables
    """
    try:
        logger.info(f"Fetching package metadata from {url}")
        
        # If it's a GitHub URL, try to fetch package.json
        if "github.com" in url:
            # Convert to raw content URL if needed
            raw_url = url.replace("github.com", "raw.githubusercontent.com")
            if not raw_url.endswith("package.json"):
                raw_url = os.path.join(raw_url, "package.json")
                
            # Use curl to fetch the package.json
            result = subprocess.run(
                ["curl", "-s", raw_url],
                capture_output=True,
                text=True,
                check=True
            )
            
            try:
                package_info = json.loads(result.stdout)
                
                # Extract environment variables from dependencies or scripts
                env_vars = {}
                if "engines" in package_info:
                    for engine, version in package_info["engines"].items():
                        if engine.upper() + "_VERSION" not in env_vars:
                            env_vars[engine.upper() + "_VERSION"] = version
                
                # Look for obvious env variables in scripts
                if "scripts" in package_info:
                    for script_content in package_info["scripts"].values():
                        env_matches = [
                            var for var in script_content.split() 
                            if var.startswith("$") and not var.startswith("$(")
                        ]
                        for var in env_matches:
                            clean_var = var.strip("$").strip("{}").strip()
                            if clean_var not in env_vars:
                                env_vars[clean_var] = "<YOUR_VALUE>"
                
                return {
                    "name": package_info.get("name", os.path.basename(url)),
                    "args": [],
                    "env": env_vars
                }
                
            except json.JSONDecodeError:
                logger.warning(f"Could not parse package.json from {raw_url}")
                
        # If it's an npm package, use npm view
        elif not url.startswith("http"):
            try:
                result = subprocess.run(
                    ["npm", "view", url, "--json"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                
                package_info = json.loads(result.stdout)
                
                # Look for common env variable patterns in the description or readme
                env_vars = {}
                descriptions = [
                    package_info.get("description", ""),
                    package_info.get("readme", "")
                ]
                
                env_patterns = [
                    "API_KEY", "TOKEN", "SECRET", "PASSWORD", "USERNAME",
                    "ENDPOINT", "URL", "HOST", "PORT", "DATABASE"
                ]
                
                for description in descriptions:
                    for pattern in env_patterns:
                        if pattern in description:
                            compound_patterns = [
                                p for p in description.split() 
                                if pattern in p and "_" in p
                            ]
                            if compound_patterns:
                                for var in compound_patterns:
                                    clean_var = var.strip("'\",.;:()[]{}").strip()
                                    if clean_var not in env_vars:
                                        env_vars[clean_var] = "<YOUR_VALUE>"
                
                return {
                    "name": package_info.get("name", url),
                    "args": [],
                    "env": env_vars
                }
                
            except Exception as e:
                logger.warning(f"Could not fetch npm package info for {url}: {str(e)}")
        
        # Default fallback
        return {
            "name": os.path.basename(url),
            "args": [],
            "env": {}
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch package metadata: {str(e)}")
        return {"name": "", "args": [], "env": {}}

def install_supabase_mcp(url: str, api_key: str, ref: Optional[str] = None, api_url: Optional[str] = None) -> bool:
    """
    Install and configure the Supabase MCP server.
    
    Args:
        url (str): Supabase project URL
        api_key (str): Supabase API key (service_role key for full access)
        ref (str, optional): Supabase project reference
        api_url (str, optional): Supabase Management API URL
    
    Returns:
        bool: True if successful, False otherwise
    """
    logger.info("Installing and configuring Supabase MCP server")
    
    # Check if the package is available
    try:
        subprocess.run(
            ["npm", "view", "supabase-mcp-server", "version"],
            capture_output=True,
            check=True
        )
    except subprocess.CalledProcessError:
        logger.error("Supabase MCP server package not found in npm registry")
        logger.info("Installing from GitHub instead...")
        
        # Try to install from GitHub
        try:
            github_url = "https://github.com/Deploya-labs/mcp-supabase"
            logger.info(f"Cloning from {github_url}...")
            
            # Create a temporary directory
            temp_dir = "temp-supabase-mcp"
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)
            
            # Clone the repository
            subprocess.run(["git", "clone", github_url, temp_dir], check=True)
            
            # Install dependencies
            logger.info("Installing dependencies...")
            subprocess.run(["npm", "install"], cwd=temp_dir, check=True)
            
            # Install from local path
            return install_local_mcp_server(temp_dir, None, {
                "SUPABASE_URL": url,
                "SUPABASE_API_KEY": api_key,
                **({"SUPABASE_PROJECT_REF": ref} if ref else {}),
                **({"SUPABASE_MANAGEMENT_API": api_url} if api_url else {})
            })
            
        except Exception as e:
            logger.error(f"Failed to install from GitHub: {str(e)}")
            logger.info("""
To install Supabase MCP manually:
1. Clone the repository: git clone https://github.com/Deploya-labs/mcp-supabase
2. Install dependencies: cd mcp-supabase && npm install
3. Install in Cursor: python3 tools/mcp_installer.py local ./mcp-supabase --env SUPABASE_URL=<your-url> SUPABASE_API_KEY=<your-key>
            """)
            return False
    
    # Prepare environment variables
    env_dict = {
        "SUPABASE_URL": url,
        "SUPABASE_API_KEY": api_key
    }
    
    # Add optional environment variables if provided
    if ref:
        env_dict["SUPABASE_PROJECT_REF"] = ref
    
    if api_url:
        env_dict["SUPABASE_MANAGEMENT_API"] = api_url
    
    # Install supabase-mcp server
    package_name = "supabase-mcp-server"
    try:
        success = install_mcp_server(package_name, None, env_dict)
        
        if success:
            logger.info("Supabase MCP server installed and configured successfully")
            logger.info("Restart Cursor for the changes to take effect")
            return True
        else:
            logger.error("Failed to install Supabase MCP server")
            return False
            
    except Exception as e:
        logger.error(f"Error installing Supabase MCP server: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Install and configure MCP servers for Cursor")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Install command
    install_parser = subparsers.add_parser("install", help="Install an MCP server via npm/uvx")
    install_parser.add_argument("name", help="Package name")
    install_parser.add_argument("--args", nargs="+", help="Arguments to pass to the MCP server")
    install_parser.add_argument("--env", nargs="+", help="Environment variables in KEY=VALUE format")

    # Local install command
    local_parser = subparsers.add_parser("local", help="Install a local MCP server")
    local_parser.add_argument("path", help="Path to local MCP server")
    local_parser.add_argument("--args", nargs="+", help="Arguments to pass to the MCP server")
    local_parser.add_argument("--env", nargs="+", help="Environment variables in KEY=VALUE format")
    
    # URL install command
    url_parser = subparsers.add_parser("url", help="Install an MCP server from a URL (GitHub, npm, etc.)")
    url_parser.add_argument("url", help="URL to install from")
    url_parser.add_argument("--args", nargs="+", help="Arguments to pass to the MCP server")
    url_parser.add_argument("--env", nargs="+", help="Environment variables in KEY=VALUE format")
    url_parser.add_argument("--auto-detect", action="store_true", help="Auto-detect args and env variables")
    
    # Supabase install command (new)
    supabase_parser = subparsers.add_parser("supabase", help="Install and configure the Supabase MCP server")
    supabase_parser.add_argument("--url", required=True, help="Supabase project URL")
    supabase_parser.add_argument("--key", required=True, help="Supabase API key (service_role key for full access)")
    supabase_parser.add_argument("--ref", help="Supabase project reference (optional)")
    supabase_parser.add_argument("--api-url", help="Supabase Management API URL (optional)")
    
    # Generate smithery.yaml command
    smithery_parser = subparsers.add_parser("smithery", help="Generate smithery.yaml for an MCP server")
    smithery_parser.add_argument("name", help="Server name")
    smithery_parser.add_argument("--command", default="npx", help="Command to run")
    smithery_parser.add_argument("--args", nargs="+", help="Arguments for the command")
    smithery_parser.add_argument("--env", nargs="+", help="Environment variables in KEY=VALUE format")

    args = parser.parse_args()

    # Process environment variables
    env_dict = {}
    if hasattr(args, 'env') and args.env:
        for env_var in args.env:
            if "=" in env_var:
                key, value = env_var.split("=", 1)
                env_dict[key] = value
            else:
                logger.warning(f"Ignoring invalid environment variable format: {env_var}")

    if args.command == "install":
        success = install_mcp_server(args.name, args.args, env_dict)
        sys.exit(0 if success else 1)
        
    elif args.command == "local":
        success = install_local_mcp_server(args.path, args.args, env_dict)
        sys.exit(0 if success else 1)
        
    elif args.command == "url":
        if args.auto_detect:
            metadata = fetch_package_metadata(args.url)
            
            # Use provided args/env or fall back to auto-detected ones
            args_to_use = args.args if args.args else metadata["args"]
            
            # For env, merge provided values with auto-detected ones
            env_to_use = metadata["env"].copy()
            env_to_use.update(env_dict)
            
            # Install based on URL type
            if "github.com" in args.url:
                # Clone repo and install locally
                repo_name = os.path.basename(args.url)
                subprocess.run(["git", "clone", args.url, repo_name], check=True)
                success = install_local_mcp_server(repo_name, args_to_use, env_to_use)
            else:
                # Assume it's an npm package
                success = install_mcp_server(metadata["name"] or args.url, args_to_use, env_to_use)
        else:
            # Manual mode - treat as npm package by default
            success = install_mcp_server(args.url, args.args, env_dict)
            
        sys.exit(0 if success else 1)
    
    elif args.command == "supabase":
        # Install Supabase MCP server
        success = install_supabase_mcp(args.url, args.key, args.ref, args.api_url)
        sys.exit(0 if success else 1)
        
    elif args.command == "smithery":
        success = generate_smithery_yaml(args.name, args.command, args.args, env_dict)
        sys.exit(0 if success else 1)
        
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main() 