/**
 * Database tools for the Ultimate Self-Evolving Cursor MCP
 * Includes SQL query execution, schema inspection, and more
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Tool definitions
const dbTools = [
  {
    name: "db_query",
    description: "Execute a SQL query on a database",
    schema: {
      type: "object",
      properties: {
        db_path: {
          type: "string",
          description: "Path to the database file (SQLite)"
        },
        query: {
          type: "string",
          description: "SQL query to execute"
        },
        params: {
          type: "array",
          description: "Optional parameters for the query",
          items: {
            type: "string"
          }
        },
        max_rows: {
          type: "number",
          description: "Maximum number of rows to return",
          default: 100
        }
      },
      required: ["db_path", "query"]
    }
  },
  {
    name: "db_schema",
    description: "Get the schema of a database",
    schema: {
      type: "object",
      properties: {
        db_path: {
          type: "string",
          description: "Path to the database file (SQLite)"
        },
        table_name: {
          type: "string",
          description: "Optional specific table to get schema for"
        }
      },
      required: ["db_path"]
    }
  },
  {
    name: "db_create",
    description: "Create a new database from a SQL script",
    schema: {
      type: "object",
      properties: {
        db_path: {
          type: "string",
          description: "Path to create the database file (SQLite)"
        },
        sql_script: {
          type: "string",
          description: "SQL script to execute (CREATE TABLE statements, etc.)"
        }
      },
      required: ["db_path", "sql_script"]
    }
  }
];

// Check if sqlite3 is available
function isSqliteAvailable() {
  try {
    const sqlite = require('sqlite3');
    return true;
  } catch (error) {
    return false;
  }
}

// Execute a SQL query
function executeSqlQuery(dbPath, query, params = [], maxRows = 100) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbPath)) {
      reject(new Error(`Database file not found: ${dbPath}`));
      return;
    }
    
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(new Error(`Failed to open database: ${err.message}`));
        return;
      }
      
      // Check if it's a SELECT query
      const isSelect = query.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        // For SELECT queries, return the results
        db.all(query, params, (err, rows) => {
          db.close();
          
          if (err) {
            reject(new Error(`Query failed: ${err.message}`));
            return;
          }
          
          // Limit number of rows
          const limitedRows = rows.slice(0, maxRows);
          const hasMore = rows.length > maxRows;
          
          resolve({
            rows: limitedRows,
            rowCount: rows.length,
            limited: hasMore
          });
        });
      } else {
        // For non-SELECT queries, just run and return affected rows
        db.run(query, params, function(err) {
          db.close();
          
          if (err) {
            reject(new Error(`Query failed: ${err.message}`));
            return;
          }
          
          resolve({
            changes: this.changes
          });
        });
      }
    });
  });
}

// Get database schema
function getDatabaseSchema(dbPath, tableName = null) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbPath)) {
      reject(new Error(`Database file not found: ${dbPath}`));
      return;
    }
    
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(new Error(`Failed to open database: ${err.message}`));
        return;
      }
      
      // Get list of tables
      let tablesQuery = "SELECT name FROM sqlite_master WHERE type='table'";
      if (tableName) {
        tablesQuery += " AND name = ?";
      }
      
      db.all(tablesQuery, tableName ? [tableName] : [], (err, tables) => {
        if (err) {
          db.close();
          reject(new Error(`Failed to get tables: ${err.message}`));
          return;
        }
        
        if (tables.length === 0) {
          db.close();
          resolve({
            tables: []
          });
          return;
        }
        
        // Get schema for each table
        const schema = {};
        let completed = 0;
        
        tables.forEach(table => {
          const tableName = table.name;
          
          // Skip sqlite internal tables
          if (tableName.startsWith('sqlite_')) {
            completed++;
            if (completed === tables.length) {
              db.close();
              resolve({ tables: schema });
            }
            return;
          }
          
          db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
            if (err) {
              db.close();
              reject(new Error(`Failed to get schema for table ${tableName}: ${err.message}`));
              return;
            }
            
            schema[tableName] = columns.map(col => ({
              name: col.name,
              type: col.type,
              notNull: col.notnull === 1,
              defaultValue: col.dflt_value,
              primaryKey: col.pk === 1
            }));
            
            completed++;
            if (completed === tables.length) {
              db.close();
              resolve({ tables: schema });
            }
          });
        });
      });
    });
  });
}

// Create a new database from a SQL script
function createDatabase(dbPath, sqlScript) {
  return new Promise((resolve, reject) => {
    // Check if the directory exists, create it if not
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
      } catch (error) {
        reject(new Error(`Failed to create directory: ${error.message}`));
        return;
      }
    }
    
    // If the database file already exists, reject
    if (fs.existsSync(dbPath)) {
      reject(new Error(`Database file already exists: ${dbPath}`));
      return;
    }
    
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Failed to create database: ${err.message}`));
        return;
      }
      
      // Execute the SQL script
      db.exec(sqlScript, (err) => {
        db.close();
        
        if (err) {
          // If there was an error, try to delete the database file
          try {
            fs.unlinkSync(dbPath);
          } catch (unlinkErr) {
            // Ignore unlink errors
          }
          
          reject(new Error(`Failed to execute SQL script: ${err.message}`));
          return;
        }
        
        resolve({
          path: dbPath,
          success: true
        });
      });
    });
  });
}

// Tool implementation handlers
async function handleDBTools(toolName, params) {
  // Check if sqlite3 is available
  if (!isSqliteAvailable()) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "SQLite (sqlite3) module is not available. Please install it with 'npm install sqlite3'"
        }
      ]
    };
  }
  
  try {
    switch (toolName) {
      case "db_query": {
        const { db_path, query, params: queryParams = [], max_rows = 100 } = params;
        
        if (!db_path || !query) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Database path and query are required"
              }
            ]
          };
        }
        
        try {
          const result = await executeSqlQuery(db_path, query, queryParams, max_rows);
          
          if (result.rows) {
            // SELECT query
            let response = '';
            
            // If there are rows, format them as a table
            if (result.rows.length > 0) {
              // Get column names
              const columns = Object.keys(result.rows[0]);
              
              // Find the maximum width for each column
              const columnWidths = {};
              columns.forEach(col => {
                columnWidths[col] = col.length;
                result.rows.forEach(row => {
                  const value = String(row[col] === null ? 'NULL' : row[col]);
                  columnWidths[col] = Math.max(columnWidths[col], value.length);
                });
              });
              
              // Create the header row
              response += columns.map(col => col.padEnd(columnWidths[col])).join(' | ') + '\n';
              
              // Create the separator row
              response += columns.map(col => '-'.repeat(columnWidths[col])).join('-+-') + '\n';
              
              // Create the data rows
              result.rows.forEach(row => {
                response += columns.map(col => {
                  const value = row[col] === null ? 'NULL' : row[col];
                  return String(value).padEnd(columnWidths[col]);
                }).join(' | ') + '\n';
              });
              
              // Add row count info
              response += `\n${result.rowCount} rows returned`;
              if (result.limited) {
                response += ` (limited to ${max_rows})`;
              }
            } else {
              response = 'Query returned no rows';
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: response
                }
              ]
            };
          } else {
            // Non-SELECT query
            return {
              content: [
                {
                  type: "text",
                  text: `Query executed successfully. ${result.changes} rows affected.`
                }
              ]
            };
          }
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Query failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "db_schema": {
        const { db_path, table_name = null } = params;
        
        if (!db_path) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Database path is required"
              }
            ]
          };
        }
        
        try {
          const schema = await getDatabaseSchema(db_path, table_name);
          
          if (Object.keys(schema.tables).length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: table_name 
                    ? `Table '${table_name}' not found in database` 
                    : 'No tables found in database'
                }
              ]
            };
          }
          
          let response = '';
          
          for (const [tableName, columns] of Object.entries(schema.tables)) {
            response += `Table: ${tableName}\n`;
            response += '-'.repeat(tableName.length + 7) + '\n';
            
            // Find the maximum width for each attribute
            const maxNameLength = Math.max(...columns.map(col => col.name.length), 'Name'.length);
            const maxTypeLength = Math.max(...columns.map(col => col.type.length), 'Type'.length);
            
            // Create the header row
            response += 'Name'.padEnd(maxNameLength) + ' | ';
            response += 'Type'.padEnd(maxTypeLength) + ' | ';
            response += 'Not Null | Default Value | Primary Key\n';
            
            // Create the separator row
            response += '-'.repeat(maxNameLength) + '-+-';
            response += '-'.repeat(maxTypeLength) + '-+-';
            response += '-'.repeat(8) + '-+-';
            response += '-'.repeat(13) + '-+-';
            response += '-'.repeat(11) + '\n';
            
            // Create the data rows
            columns.forEach(col => {
              response += col.name.padEnd(maxNameLength) + ' | ';
              response += col.type.padEnd(maxTypeLength) + ' | ';
              response += (col.notNull ? 'Yes' : 'No').padEnd(8) + ' | ';
              response += (col.defaultValue === null ? 'NULL' : col.defaultValue).toString().padEnd(13) + ' | ';
              response += (col.primaryKey ? 'Yes' : 'No').padEnd(11) + '\n';
            });
            
            response += '\n';
          }
          
          return {
            content: [
              {
                type: "text",
                text: response.trim()
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Failed to get schema: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "db_create": {
        const { db_path, sql_script } = params;
        
        if (!db_path || !sql_script) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Database path and SQL script are required"
              }
            ]
          };
        }
        
        try {
          const result = await createDatabase(db_path, sql_script);
          
          return {
            content: [
              {
                type: "text",
                text: `Database created successfully at: ${result.path}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Failed to create database: ${error.message}`
              }
            ]
          };
        }
      }
      
      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown database tool: ${toolName}`
            }
          ]
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error in database tools: ${error.message}`
        }
      ]
    };
  }
}

module.exports = {
  dbTools,
  handleDBTools
}; 