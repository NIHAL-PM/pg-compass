import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import type { AiChatMessage } from '@/shared/types/ai';

function messageToText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function buildChatMessages(messages: UIMessage[]): AiChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: messageToText(message),
  }));
}

export function createIpcChatTransport(connectionId: string): ChatTransport<UIMessage> {
  return {
    sendMessages: async ({ messages, abortSignal }) => {
      if (abortSignal?.aborted) {
        throw new Error('Chat request aborted.');
      }

      const result = await globalThis.window.aiApi.generateChat({
        connectionId,
        messages: buildChatMessages(messages),
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'AI request failed.');
      }

      const messageId = globalThis.crypto.randomUUID();

      return new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({ type: 'text-start', id: messageId });
          controller.enqueue({
            type: 'text-delta',
            id: messageId,
            delta: result.data.message,
          });
          controller.enqueue({ type: 'text-end', id: messageId });
          controller.close();
        },
      });
    },
    reconnectToStream: async () => null,
  };
}
