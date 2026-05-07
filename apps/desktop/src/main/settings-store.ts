import Store from 'electron-store';
import { safeStorage } from 'electron';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsPatch,
} from '../shared/types/settings';
import { resolveStoreOptions } from './store-config';

interface SettingsStoreSchema {
  settings: AppSettings;
}

const store = new Store<SettingsStoreSchema>({
  ...resolveStoreOptions({ name: 'settings' }),
  defaults: {
    settings: DEFAULT_APP_SETTINGS,
  },
});

const ENCRYPTED_PREFIX = 'esafe:';

function encryptField(value: string | undefined): string | undefined {
  if (!value || !safeStorage.isEncryptionAvailable()) return value;
  const encrypted = safeStorage.encryptString(value);
  return ENCRYPTED_PREFIX + encrypted.toString('base64');
}

function decryptField(value: string | undefined): string | undefined {
  if (!value?.startsWith(ENCRYPTED_PREFIX)) return value;
  if (!safeStorage.isEncryptionAvailable()) return value;
  const base64 = value.slice(ENCRYPTED_PREFIX.length);
  return safeStorage.decryptString(Buffer.from(base64, 'base64'));
}

function encryptSettings(settings: AppSettings): AppSettings {
  const encrypted = structuredClone(settings);
  for (const provider of Object.keys(encrypted.ai.providers)) {
    const config = encrypted.ai.providers[provider as keyof typeof encrypted.ai.providers];
    if (config.apiKey) {
      config.apiKey = encryptField(config.apiKey);
    }
  }
  return encrypted;
}

function decryptSettings(settings: AppSettings): AppSettings {
  const decrypted = structuredClone(settings);
  for (const provider of Object.keys(decrypted.ai.providers)) {
    const config = decrypted.ai.providers[provider as keyof typeof decrypted.ai.providers];
    if (config.apiKey) {
      config.apiKey = decryptField(config.apiKey);
    }
  }
  return decrypted;
}

function mergeSettings(
  current: AppSettings,
  patch: AppSettingsPatch,
): AppSettings {
  const providerPatch = patch.ai?.providers ?? {};
  const mergedProviders = { ...current.ai.providers };
  for (const [provider, updates] of Object.entries(providerPatch)) {
    const key = provider as keyof typeof current.ai.providers;
    mergedProviders[key] = {
      ...current.ai.providers[key],
      ...updates,
    };
  }

  return {
    general: {
      ...current.general,
      ...patch.general,
    },
    appearance: {
      ...current.appearance,
      ...patch.appearance,
    },
    privacy: {
      ...current.privacy,
      ...patch.privacy,
    },
    ai: {
      enabled: patch.ai?.enabled ?? current.ai.enabled,
      provider: patch.ai?.provider ?? current.ai.provider,
      providers: mergedProviders,
      mcp: {
        ...current.ai.mcp,
        ...patch.ai?.mcp,
      },
    },
  };
}

export function getSettings(): AppSettings {
  return decryptSettings(store.get('settings'));
}

export function updateSettings(patch: AppSettingsPatch): AppSettings {
  const current = getSettings();
  const updated = mergeSettings(current, patch);
  store.set('settings', encryptSettings(updated));
  return updated;
}
