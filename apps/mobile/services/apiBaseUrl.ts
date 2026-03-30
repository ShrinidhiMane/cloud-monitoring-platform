import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getApiBaseUrl, setApiBaseUrl } from "api-client";

const API_BASE_URL_KEY = "settings.apiBaseUrl";
const FALLBACK_LOCAL_API_URL = "http://localhost:4000";

const memoryStore: Record<string, string | null> = {};
const defaultApiBaseUrl = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL?.trim() || FALLBACK_LOCAL_API_URL,
);

let secureStoreAvailable: Promise<boolean> | null = null;

setApiBaseUrl(defaultApiBaseUrl);

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  if (!secureStoreAvailable) {
    secureStoreAvailable = SecureStore.isAvailableAsync().catch(() => false);
  }

  return secureStoreAvailable;
}

async function setStoredValue(
  key: string,
  value: string | null,
): Promise<void> {
  if (await canUseSecureStore()) {
    if (!value) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    await SecureStore.setItemAsync(key, value);
    return;
  }

  memoryStore[key] = value;
}

async function getStoredValue(key: string): Promise<string | null> {
  if (await canUseSecureStore()) {
    return SecureStore.getItemAsync(key);
  }

  return memoryStore[key] ?? null;
}

function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `http://${url}`;
}

export function normalizeApiBaseUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return defaultApiBaseUrl;
  }

  return ensureProtocol(trimmedUrl).replace(/\/+$/, "");
}

export function getDefaultApiBaseUrl(): string {
  return defaultApiBaseUrl;
}

export async function hydrateApiBaseUrl(): Promise<string> {
  const savedValue = await getStoredValue(API_BASE_URL_KEY);
  const nextValue = savedValue
    ? normalizeApiBaseUrl(savedValue)
    : defaultApiBaseUrl;

  setApiBaseUrl(nextValue);
  return nextValue;
}

export async function getConfiguredApiBaseUrl(): Promise<string> {
  const savedValue = await getStoredValue(API_BASE_URL_KEY);
  if (savedValue) {
    return normalizeApiBaseUrl(savedValue);
  }

  return getApiBaseUrl() || defaultApiBaseUrl;
}

export async function saveApiBaseUrl(url: string): Promise<string> {
  const normalizedUrl = normalizeApiBaseUrl(url);
  await setStoredValue(API_BASE_URL_KEY, normalizedUrl);
  setApiBaseUrl(normalizedUrl);
  return normalizedUrl;
}

export async function resetApiBaseUrl(): Promise<string> {
  await setStoredValue(API_BASE_URL_KEY, null);
  setApiBaseUrl(defaultApiBaseUrl);
  return defaultApiBaseUrl;
}

export async function testApiBaseUrl(
  url: string,
): Promise<{ ok: true; normalizedUrl: string } | { ok: false; error: string }> {
  const normalizedUrl = normalizeApiBaseUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      `${normalizedUrl.replace(/\/+$/, "")}/monitoring`,
      {
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        error: `Server responded with HTTP ${response.status}.`,
      };
    }

    return {
      ok: true,
      normalizedUrl,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not reach the monitoring API.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
