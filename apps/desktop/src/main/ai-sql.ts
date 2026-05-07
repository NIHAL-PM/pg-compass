import type { AiSqlExecuteParams, AiSqlExecuteResult } from '../shared/types/ai';
import { executeQuery, isReadOnlyQuery } from './table-data-rows';
import { getSettings } from './settings-store';
import { withPoolClient } from './pg-utils';

function stripTrailingSemicolons(sql: string): string {
  return sql.replace(/;+\s*$/, '');
}

function ensureSingleStatement(sql: string): string {
  const trimmed = stripTrailingSemicolons(sql.trim());
  if (trimmed.includes(';')) {
    throw new Error('Multiple SQL statements are not supported.');
  }
  return trimmed;
}

export async function executeAiSql(
  params: AiSqlExecuteParams,
): Promise<AiSqlExecuteResult> {
  const sql = ensureSingleStatement(params.sql);
  const readOnly = isReadOnlyQuery(sql);

  if (!params.allowWrite) {
    if (!readOnly) {
      throw new Error('Write queries require explicit approval.');
    }

    const data = await executeQuery({
      connectionId: params.connectionId,
      sql,
      page: params.page,
      pageSize: params.pageSize,
    });

    return {
      columns: data.columns,
      rows: data.rows,
      totalCount: data.totalCount,
      rowCount: null,
      command: 'SELECT',
    };
  }

  const settings = getSettings();
  if (settings.general.readOnlyMode) {
    throw new Error('Read-only mode is enabled.');
  }

  if (readOnly) {
    const data = await executeQuery({
      connectionId: params.connectionId,
      sql,
      page: params.page,
      pageSize: params.pageSize,
    });

    return {
      columns: data.columns,
      rows: data.rows,
      totalCount: data.totalCount,
      rowCount: null,
      command: 'SELECT',
    };
  }

  return withPoolClient(params.connectionId, async (client) => {
    await client.query('BEGIN');
    try {
      const result = await client.query(sql);
      await client.query('COMMIT');
      return {
        columns: [],
        rows: [],
        totalCount: 0,
        rowCount: result.rowCount ?? 0,
        command: result.command ?? null,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    }
  });
}
