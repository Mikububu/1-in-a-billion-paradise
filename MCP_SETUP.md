# Supabase MCP Server Setup

## ✅ Configuration Complete

The Supabase MCP server has been configured in Cursor's MCP settings.

### Configuration Details

**Location**: `~/.cursor/mcp.json`

**Project**: `yvlxhcvwxvwfakgudldp` (scoped to this project only)

**Mode**: Read-only (recommended for safety)

**URL**: `https://mcp.supabase.com/mcp?project_ref=yvlxhcvwxvwfakgudldp&read_only=true`

### Security Features Enabled

✅ **Project Scoping**: Server is limited to project `yvlxhcvwxvwfakgudldp` only
✅ **Read-Only Mode**: All queries execute as read-only Postgres user
✅ **Service Role Token**: Authenticated with provided service role token

### Available Tools

With this configuration, the MCP server provides access to:

- **Database Tools**:
  - `list_tables` - List all tables in the database
  - `list_extensions` - List database extensions
  - `list_migrations` - List database migrations
  - `execute_sql` - Execute read-only SQL queries
  - `generate_typescript_types` - Generate TypeScript types from schema

- **Documentation**:
  - `search_docs` - Search Supabase documentation

- **Development**:
  - `get_project_url` - Get project API URL
  - `get_publishable_keys` - Get API keys
  - `get_logs` - Get project logs
  - `get_advisors` - Get security/performance advisories

- **Edge Functions**:
  - `list_edge_functions` - List all edge functions
  - `get_edge_function` - Get edge function contents

### Disabled Tools (Read-Only Mode)

The following tools are disabled in read-only mode:
- `apply_migration` - Cannot apply migrations
- `create_project` - Cannot create projects
- `deploy_edge_function` - Cannot deploy functions
- `update_storage_config` - Cannot update storage config
- All branching tools (create_branch, merge_branch, etc.)

### Next Steps

1. **Restart Cursor** to load the new MCP configuration
2. **Verify Connection**: The MCP server should appear in Cursor's MCP panel
3. **Test Access**: Try asking Cursor to list tables or query data from your Supabase project

### Changing Configuration

To modify the configuration:

1. Edit `~/.cursor/mcp.json`
2. Available options:
   - Remove `read_only=true` to enable write operations (not recommended)
   - Change `project_ref` to scope to a different project
   - Add `features` parameter to enable/disable specific tool groups
   - Example: `?project_ref=xxx&features=database,docs,development`

### Security Notes

⚠️ **Important**: 
- The service role token has full database access
- Read-only mode prevents accidental writes but the token itself has write permissions
- Keep the token secure and never commit it to Git
- Consider using a separate development project for MCP access

### Alternative: OAuth Authentication

Instead of using a service role token, you can use OAuth authentication:
1. Remove the `headers` section from the config
2. Cursor will prompt you to log in to Supabase during setup
3. Choose the organization containing your project

This is more secure as it uses your user account permissions rather than a service role token.


