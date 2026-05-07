import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bot, Monitor, Moon, Palette, Settings, Shield, Sun } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import type { AiProvider, ThemePreference } from '@/shared/types/settings';

type SettingsCategory = 'general' | 'appearance' | 'privacy' | 'ai';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories: Array<{
  id: SettingsCategory;
  label: string;
  icon: typeof Settings;
}> = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'ai', label: 'AI', icon: Bot },
];

export function SettingsDialog({ open, onOpenChange }: Readonly<SettingsDialogProps>) {
  const [category, setCategory] = useState<SettingsCategory>('general');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-4xl" showCloseButton>
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure app-wide behavior and interface preferences.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex min-h-115 flex-col sm:min-h-120 sm:flex-row">
          <aside className="w-full border-b bg-muted/20 p-2 sm:w-56 sm:border-r sm:border-b-0 sm:p-3">
            <nav className="flex gap-1 sm:flex-col">
              {categories.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={category === id ? 'secondary' : 'ghost'}
                  className="justify-start gap-2"
                  onClick={() => setCategory(id)}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                </Button>
              ))}
            </nav>
          </aside>

          <section className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5">
            {category === 'general' && <GeneralSettingsPanel />}
            {category === 'appearance' && <AppearanceSettingsPanel />}
            {category === 'privacy' && <PrivacySettingsPanel />}
            {category === 'ai' && <AiSettingsPanel />}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneralSettingsPanel() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">General</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Control core behavior and power-user tooling.
      </p>

      <SettingToggleRow
        label="Set Read-Only Mode"
        description="Limit PG Compass to read operations. Inline cell edits are hidden and write requests are rejected at the main process."
        checked={settings.general.readOnlyMode}
        onCheckedChange={(checked) =>
          updateSettings({ general: { readOnlyMode: checked } })
        }
      />

      <SettingToggleRow
        label="Enable Shell Access"
        description="Allow opening a terminal connected to your PostgreSQL database (coming soon)."
        checked={settings.general.shellAccess}
        onCheckedChange={(checked) =>
          updateSettings({ general: { shellAccess: checked } })
        }
      />

      <SettingToggleRow
        label="Enable DevTools"
        description="Allow toggling Electron DevTools with Ctrl+Shift+I (Cmd+Option+I on macOS)."
        checked={settings.general.enableDevTools}
        onCheckedChange={(checked) =>
          updateSettings({ general: { enableDevTools: checked } })
        }
      />

      <SettingToggleRow
        label="Hide Internal Schemas"
        description="Hide pg_catalog, information_schema, and temporary/internal schemas in the sidebar tree."
        checked={settings.general.hideInternalSchemas}
        onCheckedChange={(checked) =>
          updateSettings({ general: { hideInternalSchemas: checked } })
        }
      />
    </div>
  );
}

function AppearanceSettingsPanel() {
  const { settings, setTheme } = useSettings();

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Appearance</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Choose how PG Compass should render across light and dark environments.
      </p>

      <Tabs value={settings.appearance.theme}>
        <TabsList className="grid w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3">
          <ThemeCard
            value="light"
            title="Light"
            description="Bright interface for daylight work."
            onSelect={setTheme}
            icon={<Sun className="size-4" />}
          >
            <ThemeLightPreview />
          </ThemeCard>

          <ThemeCard
            value="dark"
            title="Dark"
            description="Low-glare interface for focused sessions."
            onSelect={setTheme}
            icon={<Moon className="size-4" />}
          >
            <ThemeDarkPreview />
          </ThemeCard>

          <ThemeCard
            value="system"
            title="System"
            description="Follow your operating system preference."
            onSelect={setTheme}
            icon={<Monitor className="size-4" />}
          >
            <ThemeSystemPreview />
          </ThemeCard>
        </TabsList>
      </Tabs>
    </div>
  );
}

function PrivacySettingsPanel() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Privacy</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Define how the app behaves for maintenance and telemetry-related features.
      </p>

      <SettingToggleRow
        label="Enable Automatic Updates"
        description="Allow PG Compass to automatically check for and install updates (coming soon)."
        checked={settings.privacy.automaticUpdates}
        onCheckedChange={(checked) =>
          updateSettings({ privacy: { automaticUpdates: checked } })
        }
      />
    </div>
  );
}

function AiSettingsPanel() {
  const { settings, updateSettings } = useSettings();
  const providers = useMemo(
    () =>
      [
        { value: 'ollama', label: 'Ollama (Local)' },
        { value: 'openai', label: 'OpenAI' },
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'gemini', label: 'Gemini' },
        { value: 'openrouter', label: 'OpenRouter' },
      ] as const,
    [],
  );
  const providerConfig = settings.ai.providers[settings.ai.provider];
  const [model, setModel] = useState(providerConfig.model);
  const [baseUrl, setBaseUrl] = useState(providerConfig.baseUrl);
  const [apiKey, setApiKey] = useState(providerConfig.apiKey ?? '');

  useEffect(() => {
    setModel(providerConfig.model);
    setBaseUrl(providerConfig.baseUrl);
    setApiKey(providerConfig.apiKey ?? '');
  }, [providerConfig.baseUrl, providerConfig.model, providerConfig.apiKey]);

  const providerOptions = providers.map((provider) => (
    <option key={provider.value} value={provider.value}>
      {provider.label}
    </option>
  ));

  function updateProviderConfig(next: Partial<typeof providerConfig>) {
    updateSettings({
      ai: {
        providers: {
          [settings.ai.provider]: {
            ...providerConfig,
            ...next,
          },
        },
      },
    });
  }

  function updateProvider(provider: AiProvider) {
    updateSettings({ ai: { provider } });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">AI Assistant</h3>
        <p className="text-xs text-muted-foreground">
          Configure the optional BYOAI assistant. All requests are sent to the
          provider you choose.
        </p>
      </div>

      <SettingToggleRow
        label="Enable AI Assistant"
        description="Turn on the BYOAI chat tab and MCP schema context."
        checked={settings.ai.enabled}
        onCheckedChange={(checked) => updateSettings({ ai: { enabled: checked } })}
      />

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Provider</Label>
            <select
              value={settings.ai.provider}
              onChange={(event) => updateProvider(event.target.value as AiProvider)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              disabled={!settings.ai.enabled}
              aria-label="AI provider"
            >
              {providerOptions}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Model</Label>
            <Input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              onBlur={() => updateProviderConfig({ model })}
              placeholder="Model name"
              disabled={!settings.ai.enabled}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              onBlur={() => updateProviderConfig({ baseUrl })}
              placeholder="https://..."
              disabled={!settings.ai.enabled}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Stored securely with your OS keychain"
                disabled={!settings.ai.enabled}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => updateProviderConfig({ apiKey: apiKey.trim() || undefined })}
                  disabled={!settings.ai.enabled}
                >
                  Save Key
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setApiKey('');
                    updateProviderConfig({ apiKey: undefined });
                  }}
                  disabled={!settings.ai.enabled}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-sm font-semibold">MCP Schema Context</h4>
            <p className="text-xs text-muted-foreground">
              Connect to a PostgreSQL MCP server to supply schema metadata to the model.
            </p>
          </div>
          <SettingToggleRow
            label="Enable MCP Context"
            description="Fetch schema context via a Model Context Protocol server."
            checked={settings.ai.mcp.enabled}
            onCheckedChange={(checked) => updateSettings({ ai: { mcp: { enabled: checked } } })}
          />
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Server Command</Label>
            <Input
              value={settings.ai.mcp.serverCommand}
              onChange={(event) =>
                updateSettings({ ai: { mcp: { serverCommand: event.target.value } } })
              }
              placeholder="pg-mcp-server"
              disabled={!settings.ai.enabled || !settings.ai.mcp.enabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Server Args</Label>
            <Input
              value={settings.ai.mcp.serverArgs}
              onChange={(event) =>
                updateSettings({ ai: { mcp: { serverArgs: event.target.value } } })
              }
              placeholder="--stdio"
              disabled={!settings.ai.enabled || !settings.ai.mcp.enabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: Readonly<{
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

function ThemeCard({
  value,
  title,
  description,
  icon,
  onSelect,
  children,
}: Readonly<{
  value: ThemePreference;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: (theme: ThemePreference) => Promise<void>;
  children: ReactNode;
}>) {
  return (
    <TabsTrigger
      value={value}
      onClick={() => {
        void onSelect(value);
      }}
      className={cn(
        'h-auto min-h-40 w-full min-w-0 flex-col items-start justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left whitespace-normal wrap-break-word data-[state=active]:border-primary data-[state=active]:bg-accent/40',
      )}
    >
      <div className="flex w-full items-center gap-2 text-sm font-semibold">
        {icon}
        <span className="whitespace-normal wrap-break-word">{title}</span>
      </div>
      {children}
      <p className="w-full text-xs text-muted-foreground whitespace-normal wrap-break-word">
        {description}
      </p>
    </TabsTrigger>
  );
}

function ThemeLightPreview() {
  return (
    <div className="w-full rounded-md border border-zinc-200 bg-white p-2">
      <div className="mb-2 h-2 w-12 rounded bg-zinc-300" />
      <div className="space-y-1">
        <div className="h-1.5 rounded bg-zinc-200" />
        <div className="h-1.5 w-4/5 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function ThemeDarkPreview() {
  return (
    <div className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2">
      <div className="mb-2 h-2 w-12 rounded bg-zinc-500" />
      <div className="space-y-1">
        <div className="h-1.5 rounded bg-zinc-700" />
        <div className="h-1.5 w-4/5 rounded bg-zinc-700" />
      </div>
    </div>
  );
}

function ThemeSystemPreview() {
  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-border p-1">
      <div className="rounded-sm border border-zinc-200 bg-white p-1">
        <div className="h-1 rounded bg-zinc-200" />
      </div>
      <div className="rounded-sm border border-zinc-700 bg-zinc-900 p-1">
        <div className="h-1 rounded bg-zinc-700" />
      </div>
    </div>
  );
}
