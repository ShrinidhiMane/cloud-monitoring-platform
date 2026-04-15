import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const LOCAL_PIN_KEY = "localAuth.pin";
const LOCAL_BIOMETRIC_ENABLED_KEY = "localAuth.biometricEnabled";
const LOCAL_BIOMETRIC_TOKEN_KEY = "localAuth.biometricToken";
const LOCAL_BIOMETRIC_PREFERENCE_SET_KEY = "localAuth.biometricPreferenceSet";
const LOCAL_BIOMETRIC_TOKEN_VALUE = "enabled";

export const DEVICE_PIN_LENGTH = 4;
export const DEVICE_BIOMETRIC_LABEL =
  Platform.OS === "ios" ? "Face ID" : "Biometric Unlock";

const PIN_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible:
    Platform.OS === "ios"
      ? SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      : SecureStore.WHEN_UNLOCKED,
};

const BIOMETRIC_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  ...PIN_STORE_OPTIONS,
  authenticationPrompt: `Unlock Monitoring with ${DEVICE_BIOMETRIC_LABEL}`,
  requireAuthentication: true,
  keychainAccessible:
    Platform.OS === "ios"
      ? SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY
      : SecureStore.WHEN_UNLOCKED,
};

const memoryStore: Record<string, string | null> = {};
let secureStoreAvailable: Promise<boolean> | null = null;

export interface LocalAuthConfiguration {
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  hasBiometricPreferenceSet: boolean;
  hasPinConfigured: boolean;
}

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  if (!secureStoreAvailable) {
    secureStoreAvailable = SecureStore.isAvailableAsync().catch(() => false);
  }

  return secureStoreAvailable;
}

async function setItem(
  key: string,
  value: string | null,
  options: SecureStore.SecureStoreOptions = PIN_STORE_OPTIONS,
): Promise<void> {
  const normalized = value?.trim() ? value : null;

  if (await canUseSecureStore()) {
    if (!normalized) {
      await SecureStore.deleteItemAsync(key, options);
      return;
    }

    await SecureStore.setItemAsync(key, normalized, options);
    return;
  }

  memoryStore[key] = normalized;
}

async function getItem(
  key: string,
  options: SecureStore.SecureStoreOptions = PIN_STORE_OPTIONS,
): Promise<string | null> {
  if (await canUseSecureStore()) {
    return SecureStore.getItemAsync(key, options);
  }

  return memoryStore[key] ?? null;
}

async function deleteItem(
  key: string,
  options: SecureStore.SecureStoreOptions = PIN_STORE_OPTIONS,
): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(key, options);
    return;
  }

  delete memoryStore[key];
}

function normalizePin(pin: string): string {
  return pin.replace(/\D/g, "").slice(0, DEVICE_PIN_LENGTH);
}

export function canUseBiometricUnlock(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    return SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

export async function getLocalAuthConfiguration(): Promise<LocalAuthConfiguration> {
  const biometricAvailable = canUseBiometricUnlock();
  const [pin, biometricEnabled, biometricPreferenceSet] = await Promise.all([
    getItem(LOCAL_PIN_KEY),
    getItem(LOCAL_BIOMETRIC_ENABLED_KEY),
    getItem(LOCAL_BIOMETRIC_PREFERENCE_SET_KEY),
  ]);

  return {
    biometricAvailable,
    biometricEnabled: biometricAvailable && biometricEnabled === "true",
    hasBiometricPreferenceSet: biometricPreferenceSet === "true",
    hasPinConfigured: Boolean(pin),
  };
}

export async function saveLocalPin(pin: string): Promise<void> {
  const normalizedPin = normalizePin(pin);

  if (normalizedPin.length !== DEVICE_PIN_LENGTH) {
    throw new Error(`PINs must be exactly ${DEVICE_PIN_LENGTH} digits.`);
  }

  await Promise.all([
    setItem(LOCAL_PIN_KEY, normalizedPin, PIN_STORE_OPTIONS),
    deleteItem(LOCAL_BIOMETRIC_ENABLED_KEY, PIN_STORE_OPTIONS),
    deleteItem(LOCAL_BIOMETRIC_TOKEN_KEY, BIOMETRIC_STORE_OPTIONS),
    deleteItem(LOCAL_BIOMETRIC_PREFERENCE_SET_KEY, PIN_STORE_OPTIONS),
  ]);
}

export async function verifyLocalPin(pin: string): Promise<boolean> {
  const normalizedPin = normalizePin(pin);
  const storedPin = await getItem(LOCAL_PIN_KEY, PIN_STORE_OPTIONS);

  return Boolean(storedPin) && storedPin === normalizedPin;
}

export async function setBiometricUnlockEnabled(
  enabled: boolean,
): Promise<boolean> {
  if (!enabled || !canUseBiometricUnlock()) {
    await Promise.all([
      deleteItem(LOCAL_BIOMETRIC_ENABLED_KEY, PIN_STORE_OPTIONS),
      deleteItem(LOCAL_BIOMETRIC_TOKEN_KEY, BIOMETRIC_STORE_OPTIONS),
      setItem(LOCAL_BIOMETRIC_PREFERENCE_SET_KEY, "true", PIN_STORE_OPTIONS),
    ]);
    return false;
  }

  try {
    await Promise.all([
      setItem(LOCAL_BIOMETRIC_ENABLED_KEY, "true", PIN_STORE_OPTIONS),
      setItem(LOCAL_BIOMETRIC_PREFERENCE_SET_KEY, "true", PIN_STORE_OPTIONS),
      setItem(
        LOCAL_BIOMETRIC_TOKEN_KEY,
        LOCAL_BIOMETRIC_TOKEN_VALUE,
        BIOMETRIC_STORE_OPTIONS,
      ),
    ]);

    return true;
  } catch {
    await Promise.all([
      deleteItem(LOCAL_BIOMETRIC_ENABLED_KEY, PIN_STORE_OPTIONS),
      deleteItem(LOCAL_BIOMETRIC_TOKEN_KEY, BIOMETRIC_STORE_OPTIONS),
    ]);
    return false;
  }
}

export async function promptBiometricUnlock(): Promise<boolean> {
  if (!canUseBiometricUnlock()) {
    return false;
  }

  const biometricEnabled = await getItem(
    LOCAL_BIOMETRIC_ENABLED_KEY,
    PIN_STORE_OPTIONS,
  );

  if (biometricEnabled !== "true") {
    return false;
  }

  try {
    const token = await getItem(
      LOCAL_BIOMETRIC_TOKEN_KEY,
      BIOMETRIC_STORE_OPTIONS,
    );

    if (!token) {
      await setBiometricUnlockEnabled(false);
      return false;
    }

    return token === LOCAL_BIOMETRIC_TOKEN_VALUE;
  } catch {
    return false;
  }
}

export async function clearLocalAuth(): Promise<void> {
  await Promise.all([
    deleteItem(LOCAL_PIN_KEY, PIN_STORE_OPTIONS),
    deleteItem(LOCAL_BIOMETRIC_ENABLED_KEY, PIN_STORE_OPTIONS),
    deleteItem(LOCAL_BIOMETRIC_TOKEN_KEY, BIOMETRIC_STORE_OPTIONS),
    deleteItem(LOCAL_BIOMETRIC_PREFERENCE_SET_KEY, PIN_STORE_OPTIONS),
  ]);
}
