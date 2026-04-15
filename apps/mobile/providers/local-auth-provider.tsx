import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  DEVICE_BIOMETRIC_LABEL,
  clearLocalAuth,
  getLocalAuthConfiguration,
  promptBiometricUnlock,
  saveLocalPin,
  setBiometricUnlockEnabled,
  verifyLocalPin,
} from "@/services/localAuthStorage";

interface LocalAuthContextValue {
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  configurePin: (pin: string) => Promise<void>;
  hasBiometricPreferenceSet: boolean;
  hasPinConfigured: boolean;
  isHydrating: boolean;
  isUnlocked: boolean;
  lock: () => void;
  resetLocalAuth: () => Promise<void>;
  setBiometricPreference: (enabled: boolean) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
}

const LocalAuthContext = createContext<LocalAuthContextValue | null>(null);

export function LocalAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [hasPinConfigured, setHasPinConfigured] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometricPreferenceSet, setHasBiometricPreferenceSet] =
    useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshConfiguration = useCallback(async () => {
    const configuration = await getLocalAuthConfiguration();
    setHasPinConfigured(configuration.hasPinConfigured);
    setBiometricAvailable(configuration.biometricAvailable);
    setBiometricEnabled(configuration.biometricEnabled);
    setHasBiometricPreferenceSet(configuration.hasBiometricPreferenceSet);
    return configuration;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      await refreshConfiguration();

      if (!isMounted) {
        return;
      }

      setIsHydrating(false);
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [refreshConfiguration]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      appStateRef.current = nextState;

      if (wasActive && nextState === "background" && hasPinConfigured) {
        setIsUnlocked(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasPinConfigured]);

  const configurePin = useCallback(
    async (pin: string) => {
      await saveLocalPin(pin);

      setHasPinConfigured(true);
      setBiometricEnabled(false);
      setHasBiometricPreferenceSet(false);
      setIsUnlocked(true);
    },
    [],
  );

  const unlockWithPin = useCallback(async (pin: string) => {
    const didUnlock = await verifyLocalPin(pin);

    if (didUnlock) {
      setIsUnlocked(true);
    }

    return didUnlock;
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    const didUnlock = await promptBiometricUnlock();

    if (didUnlock) {
      setIsUnlocked(true);
      return true;
    }

    const configuration = await refreshConfiguration();
    setBiometricEnabled(configuration.biometricEnabled);
    setHasBiometricPreferenceSet(configuration.hasBiometricPreferenceSet);
    return false;
  }, [refreshConfiguration]);

  const setBiometricPreference = useCallback(
    async (enabled: boolean) => {
      const biometricResult = await setBiometricUnlockEnabled(enabled);
      const configuration = await refreshConfiguration();
      setBiometricAvailable(configuration.biometricAvailable);
      setBiometricEnabled(configuration.biometricEnabled);
      setHasBiometricPreferenceSet(configuration.hasBiometricPreferenceSet);
      return biometricResult;
    },
    [refreshConfiguration],
  );

  const lock = useCallback(() => {
    if (!hasPinConfigured) {
      return;
    }

    setIsUnlocked(false);
  }, [hasPinConfigured]);

  const resetLocalAuth = useCallback(async () => {
    await clearLocalAuth();
    const configuration = await refreshConfiguration();

    setHasPinConfigured(configuration.hasPinConfigured);
    setBiometricAvailable(configuration.biometricAvailable);
    setBiometricEnabled(configuration.biometricEnabled);
    setIsUnlocked(false);
  }, [refreshConfiguration]);

  const value = useMemo<LocalAuthContextValue>(
    () => ({
      biometricAvailable,
      biometricEnabled,
      biometricLabel: DEVICE_BIOMETRIC_LABEL,
      configurePin,
      hasBiometricPreferenceSet,
      hasPinConfigured,
      isHydrating,
      isUnlocked,
      lock,
      resetLocalAuth,
      setBiometricPreference,
      unlockWithBiometrics,
      unlockWithPin,
    }),
    [
      biometricAvailable,
      biometricEnabled,
      configurePin,
      hasBiometricPreferenceSet,
      hasPinConfigured,
      isHydrating,
      isUnlocked,
      lock,
      resetLocalAuth,
      setBiometricPreference,
      unlockWithBiometrics,
      unlockWithPin,
    ],
  );

  return (
    <LocalAuthContext.Provider value={value}>
      {children}
    </LocalAuthContext.Provider>
  );
}

export function useLocalAuth(): LocalAuthContextValue {
  const context = useContext(LocalAuthContext);

  if (!context) {
    throw new Error("useLocalAuth must be used within a LocalAuthProvider.");
  }

  return context;
}
