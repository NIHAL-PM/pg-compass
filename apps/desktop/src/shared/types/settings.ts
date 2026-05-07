export type ThemePreference = 'light' | 'dark' | 'system';
export type AiProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'openrouter';

export interface GeneralSettings {
  readOnlyMode: boolean;
  shellAccess: boolean;
  enableDevTools: boolean;
  hideInternalSchemas: boolean;
}

export interface AppearanceSettings {
  theme: ThemePreference;
  sidebarWidth: number;
}

export interface PrivacySettings {
  automaticUpdates: boolean;
}

export interface AiProviderConfig {
  model: string;
  baseUrl: string;
  apiKey?: string;
}

export interface AiMcpSettings {
  enabled: boolean;
  serverCommand: string;
  serverArgs: string;
}

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  providers: Record<AiProvider, AiProviderConfig>;
  mcp: AiMcpSettings;
}

export interface AiSettingsPatch {
  enabled?: boolean;
  provider?: AiProvider;
  providers?: Partial<Record<AiProvider, Partial<AiProviderConfig>>>;
  mcp?: Partial<AiMcpSettings>;
}

export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  privacy: PrivacySettings;
  ai: AiSettings;
}

export interface AppSettingsPatch {
  general?: Partial<GeneralSettings>;
  appearance?: Partial<AppearanceSettings>;
  privacy?: Partial<PrivacySettings>;
  ai?: AiSettingsPatch;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    readOnlyMode: false,
    shellAccess: false,
    enableDevTools: true,
    hideInternalSchemas: true,
  },
  appearance: {
    theme: 'dark',
    sidebarWidth: 256,
  },
  privacy: {
    automaticUpdates: true,
  },
  ai: {
    enabled: false,
    provider: 'ollama',
    providers: {
      ollama: {
        model: 'llama3.1',
        baseUrl: 'http://localhost:11434/v1',
      },
      openai: {
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
      },
      anthropic: {
        model: 'claude-3-5-sonnet-20240620',
        baseUrl: 'https://api.anthropic.com/v1',
      },
      gemini: {
        model: 'gemini-1.5-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      },
      openrouter: {
        model: 'openai/gpt-4o-mini',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
    },
    mcp: {
      enabled: false,
      serverCommand: '',
      serverArgs: '',
    },
  },
};

export const SettingsChannels = {
  GET: 'settings:get',
  UPDATE: 'settings:update',
} as const;
