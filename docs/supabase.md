# Supabase Integration Guide

The Ultimate Cursor MCP includes powerful Supabase integration, allowing you to interact with your Supabase projects directly through Cursor. This guide explains how to set up and use the Supabase MCP features.

## Setup

### Option 1: Interactive Setup (Recommended)

Run the interactive setup script that will guide you through the installation process:

```bash
./setup.sh
```

When prompted, select "y" to set up Supabase integration and provide your Supabase credentials.

### Option 2: Manual Setup

To manually install the Supabase MCP:

```bash
python3 tools/mcp_installer.py supabase --url "https://yourproject.supabase.co" --key "your-api-key"
```

Optional parameters:
- `--ref`: Your Supabase project reference
- `--api-url`: Custom Management API URL (if needed)

## Available Tools

The Supabase MCP provides the following tool categories:

### Database Tools

- `get_db_schemas`: Lists all database schemas with their sizes and table counts
- `get_tables`: Lists all tables in a schema with their sizes, row counts, and metadata
- `get_table_schema`: Gets detailed table structure including columns, keys, and relationships
- `execute_sql_query`: Executes raw SQL queries with support for all PostgreSQL operations

### Management API Tools

- `send_management_api_request`: Sends arbitrary requests to Supabase Management API
- `get_management_api_spec`: Gets the API specification with safety information
- `get_management_api_safety_rules`: Gets all safety rules with explanations
- `live_dangerously`: Switches between safe and unsafe modes

### Auth Admin Tools

- `get_auth_admin_methods_spec`: Retrieves documentation for Auth Admin methods
- `call_auth_admin_method`: Invokes Auth Admin methods (create users, list users, etc.)

## Safety Features

The Supabase MCP includes built-in safety features:

1. **Read-only mode by default**: Only read operations are allowed initially
2. **Explicit mode switch**: Use `live_dangerously` tool to enable write operations
3. **Automatic reset**: Returns to read-only mode after write operations
4. **Transaction state detection**: Prevents errors in transaction handling
5. **Safety classification**: API methods are classified as safe, unsafe, or blocked

## Example Usage

### SQL Query

```sql
-- Basic query (read-only mode)
SELECT * FROM users LIMIT 5;

-- Data modification (requires read-write mode)
INSERT INTO tasks (title, user_id) VALUES ('New task', 123);

-- Schema changes with transaction safety
BEGIN;
CREATE TABLE test_table (id SERIAL PRIMARY KEY, name TEXT);
COMMIT;
```

### Auth Operations

```
-- Create a new user
call_auth_admin_method(method="create_user", params={"email": "test@example.com", "password": "securepassword"})

-- List all users
call_auth_admin_method(method="list_users", params={"page": 1, "per_page": 10})
```

## Troubleshooting

If you encounter issues:

1. **Check your API key**: Ensure you're using a service_role key for full access
2. **Verify project URL**: Double-check your Supabase project URL
3. **Logs**: Check the MCP logs for detailed error information
4. **Configuration**: Ensure the MCP configuration is correct in `~/.cursor/mcp.json`

## More Information

For complete documentation on the Supabase MCP, visit:
https://github.com/Deploya-labs/mcp-supabase 