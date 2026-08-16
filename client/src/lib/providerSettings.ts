export type ExactProvider = "scrapingdog" | "scrapingbee";

export type ProviderSettings = {
  serperApiKey: string;
  scrapingdogApiKey: string;
  scrapingbeeApiKey: string;
  exactProvider: ExactProvider;
  fallbackEnabled: boolean;
};

const STORAGE_KEY = "kgr-provider-settings-v1";
const defaults: ProviderSettings = { serperApiKey: "", scrapingdogApiKey: "", scrapingbeeApiKey: "", exactProvider: "scrapingdog", fallbackEnabled: true };

export function loadProviderSettings(): ProviderSettings {
  if (typeof window === "undefined") return defaults;
  try { const raw = window.sessionStorage.getItem(STORAGE_KEY); return { ...defaults, ...(raw ? JSON.parse(raw) : {}) }; } catch { return defaults; }
}

export function saveProviderSettings(settings: ProviderSettings) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearProviderSettings() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
}

export function maskedKey(value: string) { return value ? `••••••••${value.slice(-4)}` : "Not set"; }
