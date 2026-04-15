import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { MONITORING_URL, getApiBaseUrl, setApiBaseUrl } from "api-client";

import { getActiveAwsSetup } from "@/services/awsSetupStorage";

const API_BASE_URL_KEY = "settings.apiBaseUrl";
const FALLBACK_MONITORING_URL = MONITORING_URL;

const memoryStore: Record<string, string | null> = {};
const defaultMonitoringUrl = normalizeMonitoringUrl(
  process.env.EXPO_PUBLIC_API_URL?.trim() || FALLBACK_MONITORING_URL,
);

let secureStoreAvailable: Promise<boolean> | null = null;

setApiBaseUrl(toApiBaseUrl(defaultMonitoringUrl));

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
  return normalizeMonitoringUrl(url);
}

function toApiBaseUrl(monitoringUrl: string): string {
  return monitoringUrl.replace(/\/monitoring\/?$/i, "");
}

function normalizeMonitoringUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return defaultMonitoringUrl;
  }

  const withoutQuery = ensureProtocol(trimmedUrl).split("?")[0];
  const baseUrl = withoutQuery.replace(/\/monitoring\/?$/i, "");

  return `${baseUrl.replace(/\/+$/, "")}/monitoring`;
}

export function getDefaultApiBaseUrl(): string {
  return defaultMonitoringUrl;
}

export async function hydrateApiBaseUrl(): Promise<string> {
  const [savedValue, activeSetup] = await Promise.all([
    getStoredValue(API_BASE_URL_KEY),
    getActiveAwsSetup(),
  ]);
  const nextValue = activeSetup?.backendUrl
    ? normalizeMonitoringUrl(activeSetup.backendUrl)
    : savedValue
      ? normalizeMonitoringUrl(savedValue)
      : defaultMonitoringUrl;

  setApiBaseUrl(toApiBaseUrl(nextValue));
  return nextValue;
}

export async function getConfiguredApiBaseUrl(): Promise<string> {
  const activeSetup = await getActiveAwsSetup();
  if (activeSetup?.backendUrl) {
    return normalizeMonitoringUrl(activeSetup.backendUrl);
  }

  const savedValue = await getStoredValue(API_BASE_URL_KEY);
  if (savedValue) {
    return normalizeMonitoringUrl(savedValue);
  }

  if (getApiBaseUrl()) {
    return normalizeMonitoringUrl(getApiBaseUrl());
  }

  return defaultMonitoringUrl;
}

export async function saveApiBaseUrl(url: string): Promise<string> {
  const normalizedUrl = normalizeMonitoringUrl(url);
  await setStoredValue(API_BASE_URL_KEY, normalizedUrl);
  setApiBaseUrl(toApiBaseUrl(normalizedUrl));
  return normalizedUrl;
}

export async function resetApiBaseUrl(): Promise<string> {
  await setStoredValue(API_BASE_URL_KEY, null);
  setApiBaseUrl(toApiBaseUrl(defaultMonitoringUrl));
  return defaultMonitoringUrl;
}

export async function testApiBaseUrl(
  url: string,
): Promise<{ ok: true; normalizedUrl: string } | { ok: false; error: string }> {
  const normalizedUrl = normalizeMonitoringUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
    });

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
