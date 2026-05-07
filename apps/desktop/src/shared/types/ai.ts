import type { ColumnInfo } from './table-data';
import type { AiProvider } from './settings';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  connectionId: string;
  messages: AiChatMessage[];
}

export interface AiChatResponse {
  message: string;
  provider: AiProvider;
  model: string;
}

export interface AiSqlExecuteParams {
  connectionId: string;
  sql: string;
  page: number;
  pageSize: number;
  allowWrite: boolean;
}

export interface AiSqlExecuteResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalCount: number;
  rowCount: number | null;
  command: string | null;
}

export const AiChannels = {
  GENERATE: 'ai:generate',
  EXECUTE_SQL: 'ai:execute-sql',
  CLEAR_CONTEXT: 'ai:clear-context',
} as const;
