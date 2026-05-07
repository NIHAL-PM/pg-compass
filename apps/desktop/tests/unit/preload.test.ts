import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const on = vi.fn();
const removeListener = vi.fn();
const exposeInMainWorld = vi.fn();

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: {
    invoke,
    on,
    removeListener,
  },
}));

describe("preload API contract", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
    on.mockReset();
    removeListener.mockReset();
    exposeInMainWorld.mockReset();
  });

  it("exposes the expected APIs and forwards invoke/on calls", async () => {
    await import("@/preload");

    const exposed = Object.fromEntries(
      exposeInMainWorld.mock.calls.map(([key, value]) => [key, value]),
    ) as {
      aiApi: {
        generateChat: (params: unknown) => Promise<unknown>;
        executeSql: (params: unknown) => Promise<unknown>;
        clearContext: (connectionId: string) => Promise<unknown>;
      };
      connectionApi: {
        getAll: () => Promise<unknown>;
        showOpenFileDialog: (options: unknown) => Promise<unknown>;
      };
      tableDataApi: {
        onExportProgress: (callback: () => void) => () => void;
        getTriggers: (params: unknown) => Promise<unknown>;
        getTypes: (params: unknown) => Promise<unknown>;
        toggleTrigger: (params: unknown) => Promise<unknown>;
        updateCell: (params: unknown) => Promise<unknown>;
        updateRow: (params: unknown) => Promise<unknown>;
        deleteRows: (params: unknown) => Promise<unknown>;
        searchForeignKey: (params: unknown) => Promise<unknown>;
      };
    };

    await exposed.connectionApi.getAll();
    expect(invoke).toHaveBeenCalledWith("connections:get-all");

    await exposed.aiApi.generateChat({ connectionId: "c1", messages: [] });
    expect(invoke).toHaveBeenCalledWith("ai:generate", {
      connectionId: "c1",
      messages: [],
    });

    await exposed.aiApi.executeSql({
      connectionId: "c1",
      sql: "select 1",
      page: 1,
      pageSize: 50,
      allowWrite: false,
    });
    expect(invoke).toHaveBeenCalledWith("ai:execute-sql", {
      connectionId: "c1",
      sql: "select 1",
      page: 1,
      pageSize: 50,
      allowWrite: false,
    });

    await exposed.aiApi.clearContext("c1");
    expect(invoke).toHaveBeenCalledWith("ai:clear-context", "c1");

    await exposed.connectionApi.showOpenFileDialog({ title: "Select file" });
    expect(invoke).toHaveBeenCalledWith("connections:show-open-file-dialog", {
      title: "Select file",
    });

    const triggerMetaParams = {
      connectionId: "c1",
      schema: "app",
      table: "users",
    };
    await exposed.tableDataApi.getTriggers(triggerMetaParams);
    expect(invoke).toHaveBeenCalledWith(
      "table-data:get-triggers",
      triggerMetaParams,
    );

    await exposed.tableDataApi.getTypes(triggerMetaParams);
    expect(invoke).toHaveBeenCalledWith(
      "table-data:get-types",
      triggerMetaParams,
    );

    const toggleTriggerParams = {
      ...triggerMetaParams,
      trigger: "users_audit_trigger",
      enabled: false,
    };
    await exposed.tableDataApi.toggleTrigger(toggleTriggerParams);
    expect(invoke).toHaveBeenCalledWith(
      "table-data:toggle-trigger",
      toggleTriggerParams,
    );

    const cleanup = exposed.tableDataApi.onExportProgress(vi.fn());
    expect(on).toHaveBeenCalledWith(
      "table-data:export-progress",
      expect.any(Function),
    );

    cleanup();
    expect(removeListener).toHaveBeenCalledWith(
      "table-data:export-progress",
      expect.any(Function),
    );

    // Write path: updateCell forwards to the UPDATE_CELL channel.
    const updateParams = {
      connectionId: "c1",
      schema: "app",
      table: "users",
      pkColumns: ["id"],
      pkValues: [1],
      column: "display_name",
      pgCast: "text",
      newValue: "new",
      setNull: false,
    };
    await exposed.tableDataApi.updateCell(updateParams);
    expect(invoke).toHaveBeenCalledWith("table-data:update-cell", updateParams);

    // Atomic multi-field row update: forwards to UPDATE_ROW.
    const rowParams = {
      connectionId: "c1",
      schema: "app",
      table: "users",
      pkColumns: ["id"],
      pkValues: [1],
      changes: [
        {
          column: "display_name",
          pgCast: "text",
          newValue: "x",
          setNull: false,
        },
        { column: "login_count", pgCast: "int4", newValue: 5, setNull: false },
      ],
    };
    await exposed.tableDataApi.updateRow(rowParams);
    expect(invoke).toHaveBeenCalledWith("table-data:update-row", rowParams);

    const deleteParams = {
      connectionId: "c1",
      schema: "app",
      table: "users",
      whereClause: "id <= 5",
    };
    await exposed.tableDataApi.deleteRows(deleteParams);
    expect(invoke).toHaveBeenCalledWith("table-data:delete-rows", deleteParams);

    // FK search: forwards to SEARCH_FK channel.
    const fkParams = {
      connectionId: "c1",
      schema: "app",
      table: "users",
      valueColumn: "id",
      labelColumn: "display_name",
      query: "ali",
      limit: 50,
    };
    await exposed.tableDataApi.searchForeignKey(fkParams);
    expect(invoke).toHaveBeenCalledWith("table-data:search-fk", fkParams);
  });
});
