import { ipcMain } from 'electron';
import { AiChannels, type AiChatRequest, type AiSqlExecuteParams } from '../shared/types/ai';
import { generateAiResponse } from './ai-bridge';
import { executeAiSql } from './ai-sql';
import { clearSchemaContextCache } from './ai-context';

export function registerAiHandlers(): void {
  ipcMain.handle(AiChannels.GENERATE, async (_event, params: AiChatRequest) => {
    try {
      const data = await generateAiResponse(params);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    AiChannels.EXECUTE_SQL,
    async (_event, params: AiSqlExecuteParams) => {
      try {
        const data = await executeAiSql(params);
        return { success: true, data };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(AiChannels.CLEAR_CONTEXT, (_event, connectionId: string) => {
    try {
      clearSchemaContextCache(connectionId);
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
