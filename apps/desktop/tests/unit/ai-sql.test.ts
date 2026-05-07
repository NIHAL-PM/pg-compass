import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AiSqlExecuteParams } from '@/shared/types/ai';

const executeQuery = vi.fn();
const withPoolClient = vi.fn();
const getSettings = vi.fn();

vi.mock('@/main/table-data-rows', () => ({
  executeQuery,
  isReadOnlyQuery: (sql: string) => sql.trim().toLowerCase().startsWith('select'),
}));

vi.mock('@/main/pg-utils', () => ({
  withPoolClient,
}));

vi.mock('@/main/settings-store', () => ({
  getSettings,
}));

describe('executeAiSql', () => {
  beforeEach(() => {
    executeQuery.mockReset();
    withPoolClient.mockReset();
    getSettings.mockReset();
    getSettings.mockReturnValue({
      general: { readOnlyMode: false },
      appearance: {},
      privacy: {},
      ai: {},
    });
  });

  it('blocks write queries without approval', async () => {
    const { executeAiSql } = await import('@/main/ai-sql');
    const params: AiSqlExecuteParams = {
      connectionId: 'c1',
      sql: 'UPDATE users SET name = \'x\'',
      page: 1,
      pageSize: 50,
      allowWrite: false,
    };

    await expect(executeAiSql(params)).rejects.toThrow(
      'Write queries require explicit approval.',
    );
  });

  it('runs read-only queries via executeQuery', async () => {
    executeQuery.mockResolvedValue({
      columns: [],
      rows: [],
      totalCount: 0,
      primaryKey: null,
    });

    const { executeAiSql } = await import('@/main/ai-sql');
    const params: AiSqlExecuteParams = {
      connectionId: 'c1',
      sql: 'SELECT 1',
      page: 1,
      pageSize: 50,
      allowWrite: false,
    };

    const result = await executeAiSql(params);
    expect(executeQuery).toHaveBeenCalledWith({
      connectionId: 'c1',
      sql: 'SELECT 1',
      page: 1,
      pageSize: 50,
    });
    expect(result.command).toBe('SELECT');
  });

  it('blocks write execution when read-only mode is enabled', async () => {
    getSettings.mockReturnValue({
      general: { readOnlyMode: true },
      appearance: {},
      privacy: {},
      ai: {},
    });

    const { executeAiSql } = await import('@/main/ai-sql');
    const params: AiSqlExecuteParams = {
      connectionId: 'c1',
      sql: 'UPDATE users SET name = \'x\'',
      page: 1,
      pageSize: 50,
      allowWrite: true,
    };

    await expect(executeAiSql(params)).rejects.toThrow('Read-only mode is enabled.');
  });
});
