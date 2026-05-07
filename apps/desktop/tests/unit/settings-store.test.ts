import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDir } from "../support/store";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

describe("settings-store", () => {
  beforeEach(() => {
    process.env.PG_COMPASS_STORE_DIR = createTempDir("pg-compass-settings-");
    vi.resetModules();
  });

  it("merges settings patches without dropping unrelated keys", async () => {
    const { getSettings, updateSettings } = await import("@/main/settings-store");

    updateSettings({
      appearance: { theme: "light" },
      general: { hideInternalSchemas: false },
    });

    expect(getSettings()).toMatchObject({
      appearance: { theme: "light" },
      general: { hideInternalSchemas: false, enableDevTools: true },
      privacy: { automaticUpdates: true },
      ai: { enabled: false, provider: "ollama", mcp: { enabled: false } },
    });
  });
});
