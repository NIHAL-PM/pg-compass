import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { AiChatRequest, AiChatResponse } from '../shared/types/ai';
import { getConnectionById } from './connection-store';
import { getSchemaContext } from './ai-context';
import { getSettings } from './settings-store';

function extractSqlBlock(text: string): { sql: string | null; message: string } {
  const match = /```sql\s*([\s\S]*?)```/i.exec(text);
  if (!match) {
    return { sql: null, message: text.trim() };
  }
  const sql = match[1]?.trim() ?? null;
  const message = text.replace(match[0], '').trim();
  return { sql, message };
}

function buildSystemPrompt(schemaContext: string, connectionLabel: string): string {
  return [
    'You are the PG Compass AI assistant. Your job is to help users explore PostgreSQL data quickly and safely.',
    'Always respect these rules:',
    '- Prefer concise responses.',
    '- If a SQL query is needed, include a single PostgreSQL query inside a ```sql``` block.',
    '- Do not include prose inside the SQL block.',
    '- When unsure, ask a clarifying question instead of guessing schema.',
    '',
    `Active connection: ${connectionLabel}`,
    'Schema context:',
    schemaContext,
  ].join('\n');
}

function buildModelMessages(messages: AiChatRequest['messages']): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function resolveModel() {
  const settings = getSettings();
  if (!settings.ai.enabled) {
    throw new Error('AI assistant is disabled in settings.');
  }

  const provider = settings.ai.provider;
  const providerConfig = settings.ai.providers[provider];
  if (!providerConfig) {
    throw new Error('AI provider configuration is missing.');
  }

  if (provider === 'ollama') {
    const openai = createOpenAI({
      baseURL: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
    });
    return { model: openai(providerConfig.model), provider, modelId: providerConfig.model };
  }

  if (provider === 'openai' || provider === 'openrouter') {
    if (!providerConfig.apiKey) {
      throw new Error('An API key is required for the selected provider.');
    }
    const openai = createOpenAI({
      baseURL: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
    });
    return { model: openai(providerConfig.model), provider, modelId: providerConfig.model };
  }

  if (provider === 'anthropic') {
    if (!providerConfig.apiKey) {
      throw new Error('An API key is required for the selected provider.');
    }
    const anthropic = createAnthropic({
      baseURL: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
    });
    return { model: anthropic(providerConfig.model), provider, modelId: providerConfig.model };
  }

  if (provider === 'gemini') {
    if (!providerConfig.apiKey) {
      throw new Error('An API key is required for the selected provider.');
    }
    const google = createGoogleGenerativeAI({
      baseURL: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
    });
    return { model: google(providerConfig.model), provider, modelId: providerConfig.model };
  }

  throw new Error('Unsupported AI provider.');
}

export async function generateAiResponse(
  request: AiChatRequest,
): Promise<AiChatResponse> {
  const connection = getConnectionById(request.connectionId);
  if (!connection) {
    throw new Error('Connection not found.');
  }

  const schemaContext = await getSchemaContext(request.connectionId);
  const system = buildSystemPrompt(schemaContext, connection.label);
  const { model, provider, modelId } = resolveModel();
  const messages = buildModelMessages(request.messages);

  const result = await generateText({
    model,
    system,
    messages,
  });

  const { message, sql } = extractSqlBlock(result.text);
  const combined = sql ? `${message}\n\n\`\`\`sql\n${sql}\n\`\`\`` : message;

  return {
    message: combined.trim(),
    provider,
    model: modelId,
  };
}
