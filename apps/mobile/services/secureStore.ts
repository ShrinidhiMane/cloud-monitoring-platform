import { Platform } from "react-native";
import type * as ExpoSecureStore from "expo-secure-store";

export type SecureStoreModule = typeof ExpoSecureStore;
export type SecureStoreOptions = ExpoSecureStore.SecureStoreOptions;

let secureStorePromise: Promise<SecureStoreModule | null> | null = null;

export async function getSecureStore(): Promise<SecureStoreModule | null> {
  if (Platform.OS === "web") {
    return null;
  }

  if (!secureStorePromise) {
    secureStorePromise = import("expo-secure-store")
      .then(async (module) => {
        const isAvailable = await module.isAvailableAsync().catch(() => false);
        return isAvailable ? module : null;
      })
      .catch(() => null);
  }

  return secureStorePromise;
}
