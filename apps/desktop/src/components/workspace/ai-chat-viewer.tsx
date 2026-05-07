import { useEffect, useMemo, useState } from 'react';
import { Bot, Play, Terminal } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ViewerShell } from '@/components/workspace/viewer-shell';
import { useWorkspace } from '@/hooks/use-workspace';
import { useSettings } from '@/hooks/use-settings';
import { DataPagination } from '@/components/workspace/table-viewer/data-pagination';
import { TableDataView } from '@/components/workspace/table-viewer/table-data-view';
import type { ColumnInfo } from '@/shared/types/table-data';
import type { DatabaseViewerPath } from '@/shared/types/workspace';
import { createIpcChatTransport } from '@/lib/ai-chat-transport';

const NON_EDITABLE_CONTEXT = {
  connectionId: '',
  schema: '',
  table: '',
  readOnly: true,
  primaryKey: null,
  onRowUpdated: () => undefined,
};

function extractSql(text: string): { sql: string | null; message: string } {
  const match = /```sql\s*([\s\S]*?)```/i.exec(text);
  if (!match) {
    return { sql: null, message: text.trim() };
  }
  const sql = match[1]?.trim() ?? null;
  const message = text.replace(match[0], '').trim();
  return { sql, message };
}

function isReadOnly(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase();
  return trimmed.startsWith('select') || trimmed.startsWith('with');
}

interface AiChatViewerProps {
  path: DatabaseViewerPath;
}

export function AiChatViewer({ path }: Readonly<AiChatViewerProps>) {
  const { settings } = useSettings();
  const { navigateToView } = useWorkspace();
  const transport = useMemo(() => createIpcChatTransport(path.connectionId), [path.connectionId]);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [allowWrite, setAllowWrite] = useState(false);

  const latestSql = useMemo(() => {
    for (const message of [...messages].reverse()) {
      if (message.role !== 'assistant') continue;
      const text = message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');
      const parsed = extractSql(text);
      if (parsed.sql) {
        return parsed.sql;
      }
    }
    return null;
  }, [messages]);

  const readOnly = latestSql ? isReadOnly(latestSql) : true;

  useEffect(() => {
    setAllowWrite(false);
    setPage(1);
  }, [latestSql]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    await sendMessage({ text: trimmed });
  }

  async function executeSql(nextPage = page, nextPageSize = pageSize) {
    if (!latestSql) return;
    setLoadingQuery(true);
    setQueryError(null);
    try {
      const result = await globalThis.window.aiApi.executeSql({
        connectionId: path.connectionId,
        sql: latestSql,
        page: nextPage,
        pageSize: nextPageSize,
        allowWrite,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Query failed.');
      }

      setColumns(result.data.columns);
      setRows(result.data.rows);
      setTotalCount(result.data.totalCount);
      setRowCount(result.data.rowCount);
      setCommand(result.data.command);
    } catch (err) {
      setQueryError((err as Error).message);
    } finally {
      setLoadingQuery(false);
    }
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    executeSql(nextPage, pageSize);
  }

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(1);
    executeSql(1, nextPageSize);
  }

  if (!settings.ai.enabled) {
    return (
      <ViewerShell
        breadcrumb={[
          {
            label: path.connectionLabel,
            view: {
              type: 'schema-list',
              path: {
                connectionId: path.connectionId,
                connectionLabel: path.connectionLabel,
              },
            },
          },
          { label: 'AI Assistant' },
        ]}
        onNavigateToView={(view) => navigateToView(view).catch(() => undefined)}
        onRefresh={() => undefined}
        refreshDisabled
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-xl bg-muted p-4">
            <Bot className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">AI Assistant disabled</h3>
          <p className="text-sm text-muted-foreground">
            Enable the BYOAI assistant in Settings to start chatting.
          </p>
        </div>
      </ViewerShell>
    );
  }

  return (
    <ViewerShell
      breadcrumb={[
        {
          label: path.connectionLabel,
          view: {
            type: 'schema-list',
            path: {
              connectionId: path.connectionId,
              connectionLabel: path.connectionLabel,
            },
          },
        },
        { label: 'AI Assistant' },
      ]}
      onNavigateToView={(view) => navigateToView(view).catch(() => undefined)}
      onRefresh={() => globalThis.window.aiApi.clearContext(path.connectionId).catch(() => undefined)}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="rounded-lg border border-border bg-card">
          <ScrollArea className="h-72">
            <div className="flex flex-col gap-3 p-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <Bot className="size-5" />
                  Ask the assistant to generate a SQL query or explain the schema.
                </div>
              )}
              {messages.map((message) => {
                const text = message.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text)
                  .join('');
                const parsed = extractSql(text);
                return (
                  <div
                    key={message.id}
                    className={
                      message.role === 'user'
                        ? 'rounded-md border border-border bg-background p-3'
                        : 'rounded-md border border-border bg-muted/30 p-3'
                    }
                  >
                    <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    {parsed.message && (
                      <p className="text-sm whitespace-pre-wrap">{parsed.message}</p>
                    )}
                    {parsed.sql && (
                      <pre className="mt-2 overflow-auto rounded-md bg-background p-2 text-xs text-foreground">
                        {parsed.sql}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {error && (
            <div className="border-t border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error.message}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend().catch(() => undefined);
                }
              }}
              placeholder="Ask: “Find users with gmail addresses”"
            />
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => handleSend().catch(() => undefined)}
              disabled={status === 'submitted' || status === 'streaming'}
            >
              <Terminal className="size-3.5" />
              Send
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">SQL Review</h4>
                <p className="text-xs text-muted-foreground">
                  Review AI-generated SQL before execution.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => executeSql().catch(() => undefined)}
                disabled={
                  !latestSql || loadingQuery || (!readOnly && !allowWrite)
                }
              >
                <Play className="size-3.5" />
                Run
              </Button>
            </div>

            {latestSql ? (
              <>
                <pre className="max-h-32 overflow-auto rounded-md bg-background p-2 text-xs">
                  {latestSql}
                </pre>
                {!readOnly && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-2">
                    <div>
                      <p className="text-xs font-semibold text-destructive">Write access required</p>
                      <p className="text-xs text-destructive/80">
                        Enable write access to run non-read-only SQL.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Allow write</Label>
                      <Switch checked={allowWrite} onCheckedChange={setAllowWrite} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                No SQL generated yet.
              </p>
            )}
            {queryError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {queryError}
              </div>
            )}
          </div>
        </div>

        {(rows.length > 0 || rowCount !== null) && (
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
              {command && command !== 'SELECT'
                ? `${command}: ${rowCount ?? 0} row${rowCount === 1 ? '' : 's'} affected`
                : `${totalCount.toLocaleString()} row${totalCount === 1 ? '' : 's'} returned`}
            </div>
            {rows.length > 0 ? (
              <div className="min-h-0 flex-1">
                <TableDataView
                  columns={columns}
                  rows={rows}
                  editContext={{ ...NON_EDITABLE_CONTEXT, connectionId: path.connectionId }}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                No rows returned.
              </div>
            )}
            {rows.length > 0 && (
              <DataPagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </div>
        )}
      </div>
    </ViewerShell>
  );
}
