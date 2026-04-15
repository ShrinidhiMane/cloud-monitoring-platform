import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AWS_SETUPS_ROUTE, TABS_ROOT_ROUTE } from "@/navigation/routes";
import { useLocalAuth } from "@/providers/local-auth-provider";
import { hasConnectedAwsSetup } from "@/services/appOnboarding";

export default function DeviceSecurityScreen() {
  const router = useRouter();
  const { biometricAvailable, biometricLabel, setBiometricPreference } =
    useLocalAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const finishStep = useCallback(async () => {
    const hasActiveAwsSetup = await hasConnectedAwsSetup();
    router.replace(hasActiveAwsSetup ? TABS_ROOT_ROUTE : AWS_SETUPS_ROUTE);
  }, [router]);

  const handleEnableBiometrics = useCallback(async () => {
    if (!biometricAvailable || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const enabled = await setBiometricPreference(true);
    setIsSubmitting(false);

    if (!enabled) {
      setStatusMessage(
        `${biometricLabel} couldn't be enabled. Continue with PIN only if you want to finish setup now.`,
      );
      return;
    }

    await finishStep();
  }, [
    biometricAvailable,
    biometricLabel,
    finishStep,
    isSubmitting,
    setBiometricPreference,
  ]);

  const handleSkip = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await setBiometricPreference(false);
    setIsSubmitting(false);
    await finishStep();
  }, [finishStep, isSubmitting, setBiometricPreference]);

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
                <Text style={styles.stepBadgeText}>Step 2 of 3</Text>
              </View>
              <View style={styles.storageBadge}>
                <MaterialCommunityIcons
                  color="#1D4ED8"
                  name="face-recognition"
                  size={14}
                />
                <Text style={styles.storageBadgeText}>Optional unlock</Text>
              </View>
            </View>
            <Text style={styles.stepCaption}>
              Face ID is optional and can be changed later in Settings.
            </Text>

            <View style={styles.heroCard}>
              <View style={styles.deviceFrame}>
                <View style={styles.deviceNotch} />
                <View style={styles.faceBadge}>
                  <MaterialCommunityIcons
                    color="#0F172A"
                    name={biometricAvailable ? "face-recognition" : "shield-lock"}
                    size={32}
                  />
                </View>
                <Text style={styles.deviceFrameTitle}>
                  {biometricAvailable ? biometricLabel : "PIN only"}
                </Text>
                <Text style={styles.deviceFrameText}>
                  {biometricAvailable
                    ? "Use a local biometric unlock token for faster access."
                    : "This device will keep using the PIN you just created."}
                </Text>
              </View>

              <View style={styles.copyBlock}>
                <Text style={styles.eyebrow}>Device security</Text>
                <Text style={styles.title}>
                  {biometricAvailable
                    ? `Turn on ${biometricLabel}?`
                    : "Security setup is ready"}
                </Text>
                <Text style={styles.subtitle}>
                  {biometricAvailable
                    ? `${biometricLabel} becomes a quick unlock option after the PIN is set. Your biometric data stays under iOS control.`
                    : "This iPhone doesn't expose biometric unlock right now, so the app will continue using your local PIN only."}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.featureList}>
              <FeatureRow
                icon="lock-outline"
                title="PIN stays local"
                description="The app stores only a local PIN and optional biometric token on this device."
              />
              <FeatureRow
                icon="numeric-4-box"
                title="PIN still works"
                description="Even with Face ID enabled, you'll always be able to unlock with the device PIN."
              />
              <FeatureRow
                icon="toggle-switch-outline"
                title="You can change this later"
                description="Turn Face ID on or off from Settings whenever you want."
              />
            </View>

            {statusMessage ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {biometricAvailable ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() => {
                    void handleEnableBiometrics();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    isSubmitting && styles.buttonDisabled,
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonLabel}>
                      Enable {biometricLabel}
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => {
                  void handleSkip();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                  isSubmitting && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonLabel}>
                  {biometricAvailable ? "Continue With PIN Only" : "Continue"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <MaterialCommunityIcons color="#0F172A" name={icon} size={18} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  ambientTop: {
    position: "absolute",
    top: -90,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#E3EEFF",
  },
  ambientBottom: {
    position: "absolute",
    bottom: -110,
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "#EDF4FF",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    paddingBottom: 32,
  },
  container: {
    gap: 16,
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
    gap: 14,
  },
  deviceFrame: {
    alignItems: "center",
    alignSelf: "center",
    width: 182,
    borderRadius: 30,
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  deviceNotch: {
    width: 72,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    marginBottom: 18,
  },
  faceBadge: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0FF",
    marginBottom: 14,
  },
  deviceFrameTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  deviceFrameText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#CBD5E1",
    textAlign: "center",
  },
  copyBlock: {
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "#D9E4FF",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "#2563EB",
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
    paddingVertical: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  featureList: {
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F0FF",
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
  },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#92400E",
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 20,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 20,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
