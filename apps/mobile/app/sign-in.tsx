import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLocalAuth } from "@/providers/local-auth-provider";
import { DEVICE_PIN_LENGTH } from "@/services/localAuthStorage";

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export default function SignInScreen() {
  const {
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    configurePin,
    hasPinConfigured,
    isHydrating,
    unlockWithBiometrics,
    unlockWithPin,
  } = useLocalAuth();
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasPromptedBiometricsRef = useRef(false);

  const isSetupMode = !hasPinConfigured;
  const canUseBiometricButton =
    !isSetupMode && biometricAvailable && biometricEnabled;
  const title = isSetupMode
    ? pendingPin
      ? "Confirm your PIN"
      : "Create your device PIN"
    : "Unlock Monitoring";
  const subtitle = isSetupMode
    ? pendingPin
      ? "Enter the same four digits again so this device can save them securely."
      : "Set a four-digit PIN first. Face ID comes next, then you'll connect the monitoring endpoint."
    : canUseBiometricButton
      ? `Use ${biometricLabel} or enter the PIN saved on this iPhone.`
      : "Enter the PIN saved on this device to continue.";
  const defaultStatusMessage = isSetupMode
    ? pendingPin
      ? "Re-enter the same PIN to finish step 1."
      : "This PIN stays on the device and unlocks the app locally."
    : canUseBiometricButton
      ? `${biometricLabel} is ready if you prefer not to type your PIN.`
      : "PIN unlock is active on this device.";

  const handleBiometricUnlock = useCallback(async () => {
    if (!canUseBiometricButton || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const didUnlock = await unlockWithBiometrics();
    setIsSubmitting(false);

    if (didUnlock) {
      return;
    }

    setEnteredPin("");
    setStatusMessage(`Couldn't verify with ${biometricLabel}. Enter your PIN.`);
  }, [biometricLabel, canUseBiometricButton, isSubmitting, unlockWithBiometrics]);

  useEffect(() => {
    if (
      !canUseBiometricButton ||
      hasPromptedBiometricsRef.current ||
      isHydrating
    ) {
      return;
    }

    hasPromptedBiometricsRef.current = true;
    void handleBiometricUnlock();
  }, [canUseBiometricButton, handleBiometricUnlock, isHydrating]);

  const handleUnlockPin = useCallback(
    async (pin: string) => {
      setIsSubmitting(true);
      const didUnlock = await unlockWithPin(pin);
      setIsSubmitting(false);

      if (didUnlock) {
        return;
      }

      setEnteredPin("");
      setStatusMessage("That PIN doesn't match this device.");
    },
    [unlockWithPin],
  );

  const handleSetupPin = useCallback(
    async (pin: string) => {
      if (!pendingPin) {
        setPendingPin(pin);
        setEnteredPin("");
        setStatusMessage("Good. Enter the same PIN once more to confirm it.");
        return;
      }

      if (pendingPin !== pin) {
        setPendingPin(null);
        setEnteredPin("");
        setStatusMessage("Those PINs didn't match. Start over with a new one.");
        return;
      }

      setIsSubmitting(true);
      await configurePin(pin);
      setIsSubmitting(false);

      setEnteredPin("");
      setPendingPin(null);
      setStatusMessage("PIN saved securely on this device.");
    },
    [configurePin, pendingPin],
  );

  const handleCompletedPin = useCallback(
    async (pin: string) => {
      if (isSubmitting) {
        return;
      }

      if (isSetupMode) {
        await handleSetupPin(pin);
        return;
      }

      await handleUnlockPin(pin);
    },
    [handleSetupPin, handleUnlockPin, isSetupMode, isSubmitting],
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (enteredPin.length >= DEVICE_PIN_LENGTH || isSubmitting) {
        return;
      }

      const nextValue = `${enteredPin}${digit}`;
      setEnteredPin(nextValue);

      if (nextValue.length === DEVICE_PIN_LENGTH) {
        void handleCompletedPin(nextValue);
      }
    },
    [enteredPin, handleCompletedPin, isSubmitting],
  );

  const removeDigit = useCallback(() => {
    if (!enteredPin || isSubmitting) {
      return;
    }

    setEnteredPin((current) => current.slice(0, -1));
  }, [enteredPin, isSubmitting]);

  const resetSetup = useCallback(() => {
    setPendingPin(null);
    setEnteredPin("");
    setStatusMessage("Create a new four-digit PIN for this device.");
  }, []);

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#0F172A" size="large" />
          <Text style={styles.loadingText}>Loading secure device sign-in...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View pointerEvents="none" style={styles.ambientTop} />
      <View pointerEvents="none" style={styles.ambientBottom} />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.topRail}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {isSetupMode ? "Step 1 of 3" : "Device sign-in"}
                </Text>
              </View>
              <View style={styles.storageBadge}>
                <MaterialCommunityIcons
                  color="#1D4ED8"
                  name="cellphone-lock"
                  size={14}
                />
                <Text style={styles.storageBadgeText}>On-device only</Text>
              </View>
            </View>

            <Text style={styles.stepCaption}>
              {isSetupMode
                ? pendingPin
                  ? "Confirm the PIN to finish setup."
                  : "Set the local PIN before Face ID."
                : "Secure unlock for this device"}
            </Text>

            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons
                    color="#0F172A"
                    name={isSetupMode ? "shield-lock-outline" : "shield-check"}
                    size={34}
                  />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>4-digit PIN</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    {isSetupMode ? "Face ID next" : "Quick unlock ready"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelEyebrow}>
                {isSetupMode ? "Local unlock" : "Secure access"}
              </Text>
              <Text style={styles.panelStatus}>
                {statusMessage ?? defaultStatusMessage}
              </Text>
            </View>

            <View style={styles.pinDotsRow}>
              {Array.from({ length: DEVICE_PIN_LENGTH }).map((_, index) => {
                const isFilled = index < enteredPin.length;
                return (
                  <View
                    key={index}
                    style={[
                      styles.pinDot,
                      isFilled && styles.pinDotFilled,
                      isSubmitting && styles.pinDotPending,
                    ]}
                  />
                );
              })}
            </View>

            {canUseBiometricButton ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => {
                  void handleBiometricUnlock();
                }}
                style={({ pressed }) => [
                  styles.biometricCard,
                  pressed && styles.cardPressed,
                  isSubmitting && styles.cardDisabled,
                ]}
              >
                <View style={styles.biometricIcon}>
                  <MaterialCommunityIcons
                    color="#0F172A"
                    name={
                      Platform.OS === "ios" ? "face-recognition" : "fingerprint"
                    }
                    size={22}
                  />
                </View>
                <View style={styles.biometricCopy}>
                  <Text style={styles.biometricTitle}>Use {biometricLabel}</Text>
                  <Text style={styles.biometricDescription}>
                    Quick unlock is already enabled for this device.
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.deviceOnlyCard}>
                <Text style={styles.deviceOnlyTitle}>Stored only on this device</Text>
                <Text style={styles.deviceOnlyText}>
                  The PIN stays local, and the next step lets you decide if Face
                  ID should unlock the app too.
                </Text>
              </View>
            )}

            {isSubmitting ? (
              <View style={styles.inlineLoadingRow}>
                <ActivityIndicator color="#0F172A" />
                <Text style={styles.inlineLoadingText}>
                  {isSetupMode ? "Saving secure PIN..." : "Verifying access..."}
                </Text>
              </View>
            ) : null}

            <View style={styles.keypad}>
              {DIGIT_ROWS.map((row) => (
                <View key={row.join("-")} style={styles.keypadRow}>
                  {row.map((digit) => (
                    <Pressable
                      key={digit}
                      accessibilityLabel={`Enter ${digit}`}
                      accessibilityRole="button"
                      onPress={() => {
                        appendDigit(digit);
                      }}
                      style={({ pressed }) => [
                        styles.keyButton,
                        pressed && styles.keyButtonPressed,
                      ]}
                    >
                      <Text style={styles.keyButtonLabel}>{digit}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}

              <View style={styles.keypadRow}>
                {canUseBiometricButton ? (
                  <Pressable
                    accessibilityLabel={`Unlock with ${biometricLabel}`}
                    accessibilityRole="button"
                    onPress={() => {
                      void handleBiometricUnlock();
                    }}
                    style={({ pressed }) => [
                      styles.keyButton,
                      styles.utilityKeyButton,
                      pressed && styles.keyButtonPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      color="#0F172A"
                      name={
                        Platform.OS === "ios" ? "face-recognition" : "fingerprint"
                      }
                      size={26}
                    />
                  </Pressable>
                ) : (
                  <View style={styles.keyButtonPlaceholder} />
                )}

                <Pressable
                  accessibilityLabel="Enter 0"
                  accessibilityRole="button"
                  onPress={() => {
                    appendDigit("0");
                  }}
                  style={({ pressed }) => [
                    styles.keyButton,
                    pressed && styles.keyButtonPressed,
                  ]}
                >
                  <Text style={styles.keyButtonLabel}>0</Text>
                </Pressable>

                <Pressable
                  accessibilityLabel="Delete last digit"
                  accessibilityRole="button"
                  onPress={removeDigit}
                  style={({ pressed }) => [
                    styles.keyButton,
                    styles.utilityKeyButton,
                    pressed && styles.keyButtonPressed,
                  ]}
                >
                  <MaterialIcons color="#0F172A" name="backspace" size={24} />
                </Pressable>
              </View>
            </View>

            {isSetupMode && pendingPin ? (
              <Pressable
                accessibilityRole="button"
                onPress={resetSetup}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.secondaryActionPressed,
                ]}
              >
                <Text style={styles.secondaryActionLabel}>Start Over</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  ambientTop: {
    position: "absolute",
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#DCEBFF",
  },
  ambientBottom: {
    position: "absolute",
    bottom: -120,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#E9F1FF",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    paddingBottom: 32,
  },
  container: {
    gap: 16,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  header: {
    gap: 12,
  },
  topRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stepBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  stepCaption: {
    fontSize: 13,
    color: "#475569",
    paddingHorizontal: 2,
  },
  storageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#E8F0FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  storageBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#D9E4FF",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F0FF",
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  panel: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E4FF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  panelHeader: {
    gap: 6,
  },
  panelEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "#2563EB",
  },
  panelStatus: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  pinDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 2,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#A8B6C9",
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A",
  },
  pinDotPending: {
    opacity: 0.55,
  },
  biometricCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#DCE7F7",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  biometricIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F0FF",
  },
  biometricCopy: {
    flex: 1,
    gap: 2,
  },
  biometricTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  biometricDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
  },
  deviceOnlyCard: {
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#DCE7F7",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  deviceOnlyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  deviceOnlyText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
  },
  inlineLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  inlineLoadingText: {
    fontSize: 13,
    color: "#475569",
  },
  keypad: {
    gap: 10,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  keyButton: {
    width: 80,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFEFF",
    borderWidth: 1,
    borderColor: "#D9E4FF",
  },
  utilityKeyButton: {
    backgroundColor: "#F6F9FC",
  },
  keyButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  keyButtonLabel: {
    fontSize: 27,
    fontWeight: "700",
    color: "#0F172A",
  },
  keyButtonPlaceholder: {
    width: 80,
    height: 76,
  },
  secondaryAction: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  secondaryActionPressed: {
    opacity: 0.76,
  },
  secondaryActionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardDisabled: {
    opacity: 0.6,
  },
});
