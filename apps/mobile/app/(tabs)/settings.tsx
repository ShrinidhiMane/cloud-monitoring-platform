import { ScreenStateCard } from "@/components/ScreenStateCard";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AWS_SETUPS_ROUTE, SIGN_IN_ROUTE } from "@/navigation/routes";
import { useLocalAuth } from "@/providers/local-auth-provider";
import {
  getActiveAwsSetup,
  listAwsSetupProfiles,
  type AwsSetupProfile,
} from "@/services/awsSetupStorage";

// Manages device security, AWS connection profiles, and local storage preferences
export default function SettingsScreen() {
  const router = useRouter();
  const {
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    lock,
    resetLocalAuth,
    setBiometricPreference,
  } = useLocalAuth();
  const [activeProfile, setActiveProfile] = useState<AwsSetupProfile | null>(
    null,
  );
  const [savedSetupCount, setSavedSetupCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Device sign-in and monitoring connection settings are stored locally on this device.",
  );
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

  const loadConnectionState = useCallback(async () => {
    const [nextActiveProfile, profiles] = await Promise.all([
      getActiveAwsSetup(),
      listAwsSetupProfiles(),
    ]);

    setActiveProfile(nextActiveProfile);
    setSavedSetupCount(profiles.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConnectionState();
    }, [loadConnectionState]),
  );

  const handleLockNow = useCallback(() => {
    lock();
    router.replace(SIGN_IN_ROUTE);
  }, [lock, router]);

  const handleToggleBiometrics = useCallback(async () => {
    setIsUpdatingSecurity(true);
    const nextValue = await setBiometricPreference(!biometricEnabled);

    setStatusMessage(
      nextValue
        ? `${biometricLabel} is enabled for device unlocks.`
        : `${biometricLabel} is off. The app will keep using your PIN on this device.`,
    );
    setIsUpdatingSecurity(false);
  }, [biometricEnabled, biometricLabel, setBiometricPreference]);

  const handleResetDeviceSignIn = useCallback(() => {
    Alert.alert(
      "Reset Device Sign-In",
      "This clears the saved PIN and biometric unlock token from this device. You'll create a new PIN the next time the app opens.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsUpdatingSecurity(true);
              await resetLocalAuth();
              setIsUpdatingSecurity(false);
              setStatusMessage(
                "Device sign-in cleared. Create a new PIN when the app opens again.",
              );
              router.replace(SIGN_IN_ROUTE);
            })();
          },
        },
      ],
    );
  }, [resetLocalAuth, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Settings</Text>
          <Text style={styles.title}>This Device</Text>
          <Text style={styles.subtitle}>
            Manage how the app unlocks, which monitoring connection is active,
            and what stays stored only on this iPhone.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Local Status</Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIcon}>
              <MaterialCommunityIcons
                color="#0F172A"
                name="shield-check"
                size={22}
              />
            </View>
            <View style={styles.panelCopy}>
              <Text style={styles.panelTitle}>Device Security</Text>
              <Text style={styles.panelSubtitle}>
                PIN unlock is always local to this device.
              </Text>
            </View>
          </View>

          <View style={styles.securityStateRow}>
            <Text style={styles.securityStateLabel}>Current unlock</Text>
            <Text style={styles.securityStateValue}>
              {biometricAvailable
                ? biometricEnabled
                  ? `PIN + ${biometricLabel}`
                  : "PIN only"
                : "PIN only"}
            </Text>
          </View>

          <View style={styles.buttonGroup}>
            <Pressable
              accessibilityRole="button"
              disabled={isUpdatingSecurity}
              onPress={handleLockNow}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isUpdatingSecurity && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>Lock App Now</Text>
            </Pressable>

            {biometricAvailable ? (
              <Pressable
                accessibilityRole="button"
                disabled={isUpdatingSecurity}
                onPress={() => {
                  void handleToggleBiometrics();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                  isUpdatingSecurity && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonLabel}>
                  {biometricEnabled
                    ? `Turn ${biometricLabel} Off`
                    : `Turn ${biometricLabel} On`}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isUpdatingSecurity}
              onPress={handleResetDeviceSignIn}
              style={({ pressed }) => [
                styles.dangerButton,
                pressed && styles.secondaryButtonPressed,
                isUpdatingSecurity && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.dangerButtonLabel}>Reset Device Sign-In</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelIcon}>
              <MaterialCommunityIcons
                color="#0F172A"
                name="server-network"
                size={22}
              />
            </View>
            <View style={styles.panelCopy}>
              <Text style={styles.panelTitle}>Active Connection</Text>
              <Text style={styles.panelSubtitle}>
                Choose which saved monitoring endpoint this device uses by default.
              </Text>
            </View>
          </View>

          {activeProfile ? (
            <View style={styles.connectionCard}>
              <Text style={styles.connectionName}>{activeProfile.label}</Text>
              <Text style={styles.connectionMeta}>
                {formatConnectionSummary(activeProfile)}
              </Text>
              <Text style={styles.connectionMeta}>
                Monitoring URL: {activeProfile.backendUrl}
              </Text>
              {activeProfile.instanceName ? (
                <Text style={styles.connectionMeta}>
                  Instance name: {activeProfile.instanceName}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyConnectionCard}>
              <Text style={styles.emptyConnectionTitle}>
                No instance connection selected
              </Text>
              <Text style={styles.emptyConnectionText}>
                Save a monitoring connection so the app knows which live endpoint
                this device should use.
              </Text>
            </View>
          )}

          <View style={styles.connectionFooter}>
            <Text style={styles.connectionFooterText}>
              Saved connections on device: {savedSetupCount}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                router.push(AWS_SETUPS_ROUTE);
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.manageButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonLabel}>
                {activeProfile ? "Manage Setups" : "Connect Monitoring"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.storageCard}>
          <Text style={styles.storageTitle}>Stored Only On This Device</Text>
          <Text style={styles.storageText}>
            The PIN, biometric unlock token, monitoring URL, optional AWS
            credentials, and saved instance notes stay in local device storage.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatConnectionSummary(profile: AwsSetupProfile): string {
  const parts = [profile.region, profile.instanceId].filter(
    (value) => value.trim().length > 0,
  );

  if (!parts.length) {
    return "Monitoring URL only";
  }

  return parts.join(" • ");
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F7FF",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#2563EB",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  statusCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D9E4FF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#2563EB",
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D9E4FF",
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 16,
  },
  panelHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  panelIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4FF",
  },
  panelCopy: {
    flex: 1,
    gap: 3,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  securityStateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  securityStateLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  securityStateValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  buttonGroup: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  manageButton: {
    minWidth: 160,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  dangerButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 16,
  },
  dangerButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#B91C1C",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  connectionCard: {
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 6,
  },
  connectionName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  connectionMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  emptyConnectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9E4FF",
    backgroundColor: "#EEF4FF",
    padding: 16,
    gap: 6,
  },
  emptyConnectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyConnectionText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  connectionFooter: {
    gap: 10,
  },
  connectionFooterText: {
    fontSize: 13,
    color: "#64748B",
  },
  storageCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D9E4FF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  storageTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  storageText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#475569",
  },
});
