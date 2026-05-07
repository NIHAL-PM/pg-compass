import { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import type { ConnectionConfig } from '../shared/types/connection';
import { getConnectionById } from './connection-store';
import { withPoolClient } from './pg-utils';
import { getSettings } from './settings-store';

const MCP_TOOL_NAME = 'get_schema';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedContext = { text: string; updatedAt: number };

const contextCache = new Map<string, CachedContext>();
let mcpClientState: { key: string; client: Client } | null = null;
let mcpConnecting: Promise<Client | null> | null = null;

function parseArgs(value: string): string[] {
  if (!value.trim()) return [];
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!matches) return [];
  return matches.map((arg) => arg.replace(/^"|"$/g, ''));
}

function buildConnectionString(connection: ConnectionConfig): string | null {
  if (connection.mode === 'uri') {
    return connection.uri?.trim() || null;
  }

  if (!connection.fields) return null;

  const url = new URL('postgresql://localhost');
  url.hostname = connection.fields.host;
  url.port = String(connection.fields.port);
  url.pathname = `/${encodeURIComponent(connection.fields.database)}`;
  url.username = connection.fields.user;
  url.password = connection.fields.password;
  return url.toString();
}

async function ensureMcpClient(): Promise<Client | null> {
  const settings = getSettings();
  const command = settings.ai.mcp.serverCommand.trim();
  if (!settings.ai.mcp.enabled || !command) {
    return null;
  }

  const key = `${command}::${settings.ai.mcp.serverArgs.trim()}`;
  if (mcpClientState?.key === key) {
    return mcpClientState.client;
  }

  if (mcpConnecting) {
    return mcpConnecting;
  }

  mcpConnecting = (async () => {
    const client = new Client({
      name: 'pg-compass',
      version: app.getVersion(),
    });
    const args = parseArgs(settings.ai.mcp.serverArgs);
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);
    mcpClientState = { key, client };
    mcpConnecting = null;
    return client;
  })().catch((err) => {
    mcpConnecting = null;
    throw err;
  });

  return mcpConnecting;
}

async function loadContextFromMcp(connectionId: string): Promise<string> {
  const client = await ensureMcpClient();
  if (!client) {
    throw new Error('MCP client is not configured.');
  }

  const connection = getConnectionById(connectionId);
  if (!connection) {
    throw new Error('Connection not found.');
  }

  const connectionString = buildConnectionString(connection);
  const result = await client.callTool({
    name: MCP_TOOL_NAME,
    arguments: {
      connectionString,
      connectionId,
    },
  });

  const text = result.content.find((item) => item.type === 'text')?.text?.trim();
  if (!text) {
    throw new Error('MCP server returned no schema context.');
  }

  return text;
}

async function loadContextFromDatabase(connectionId: string): Promise<string> {
  const settings = getSettings();
  const hideInternal = settings.general.hideInternalSchemas;
  const schemaFilter = hideInternal
    ? "AND table_schema NOT IN ('pg_catalog', 'information_schema')"
    : '';

  return withPoolClient(connectionId, async (client) => {
    const tablesResult = await client.query<{
      table_schema: string;
      table_name: string;
    }>(
      `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      ${schemaFilter}
      ORDER BY table_schema, table_name
      `,
    );

    const columnsResult = await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `
      SELECT table_schema, table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema IN (
        SELECT table_schema
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        ${schemaFilter}
      )
      ORDER BY table_schema, table_name, ordinal_position
      `,
    );

    const fkResult = await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      foreign_table_schema: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(
      `
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ${schemaFilter}
      ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
      `,
    );

    const tableMap = new Map<string, { schema: string; table: string; columns: string[] }>();
    for (const table of tablesResult.rows) {
      const key = `${table.table_schema}.${table.table_name}`;
      tableMap.set(key, { schema: table.table_schema, table: table.table_name, columns: [] });
    }

    for (const column of columnsResult.rows) {
      const key = `${column.table_schema}.${column.table_name}`;
      const entry = tableMap.get(key);
      if (!entry) continue;
      const nullable = column.is_nullable === 'YES' ? 'null' : 'not null';
      entry.columns.push(`${column.column_name} ${column.data_type} (${nullable})`);
    }

    const fkMap = new Map<string, string[]>();
    for (const fk of fkResult.rows) {
      const key = `${fk.table_schema}.${fk.table_name}`;
      const line = `${fk.column_name} -> ${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}`;
      const list = fkMap.get(key) ?? [];
      list.push(line);
      fkMap.set(key, list);
    }

    if (tableMap.size === 0) {
      return 'No tables found in the connected database.';
    }

    const lines: string[] = [];
    const schemas = [...new Set([...tableMap.values()].map((item) => item.schema))].sort();
    for (const schema of schemas) {
      lines.push(`Schema ${schema}`);
      for (const entry of [...tableMap.values()].filter((item) => item.schema === schema)) {
        lines.push(`  Table ${entry.table}`);
        if (entry.columns.length > 0) {
          lines.push(`    Columns: ${entry.columns.join(', ')}`);
        }
        const fks = fkMap.get(`${entry.schema}.${entry.table}`);
        if (fks && fks.length > 0) {
          lines.push(`    Foreign Keys: ${fks.join('; ')}`);
        }
      }
    }

    return lines.join('\n');
  });
}

export async function getSchemaContext(connectionId: string): Promise<string> {
  const cached = contextCache.get(connectionId);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.text;
  }

  const settings = getSettings();
  let contextText = '';
  if (settings.ai.mcp.enabled && settings.ai.mcp.serverCommand.trim()) {
    try {
      contextText = await loadContextFromMcp(connectionId);
    } catch {
      contextText = await loadContextFromDatabase(connectionId);
    }
  } else {
    contextText = await loadContextFromDatabase(connectionId);
  }

  contextCache.set(connectionId, { text: contextText, updatedAt: Date.now() });
  return contextText;
}

export function clearSchemaContextCache(connectionId: string): void {
  contextCache.delete(connectionId);
}
