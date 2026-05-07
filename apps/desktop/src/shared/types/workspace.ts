export interface DatabaseViewerPath {
  connectionId: string;
  connectionLabel: string;
}

export interface WorkspacePath extends DatabaseViewerPath {
  schemaName: string;
}

export interface SchemaViewerPath extends WorkspacePath {}

export interface TableListViewerPath extends WorkspacePath {
  tableName: string;
}

export interface ViewListViewerPath extends WorkspacePath {
  viewName: string;
}

export interface AiChatViewerPath extends DatabaseViewerPath {}

export type WorkspaceTabView =
  | {
      type: 'schema-list';
      path: DatabaseViewerPath;
    }
  | {
      type: 'ai-chat';
      path: AiChatViewerPath;
    }
  | {
      type: 'schema';
      path: SchemaViewerPath;
    }
  | {
      type: 'table-list';
      path: TableListViewerPath;
    }
  | {
      type: 'table-details';
      path: TableListViewerPath;
    }
  | {
      type: 'view-list';
      path: ViewListViewerPath;
    }
  | {
      type: 'view-details';
      path: ViewListViewerPath;
    };

export interface WorkspaceTab {
  id: string;
  title: string;
  color?: string;
  view: WorkspaceTabView;
}
