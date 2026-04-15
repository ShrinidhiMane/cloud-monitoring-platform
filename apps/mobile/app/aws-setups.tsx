import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { StatusBanner } from "@/components/StatusBanner";
import { TABS_ROOT_ROUTE } from "@/navigation/routes";
import { normalizeApiBaseUrl, saveApiBaseUrl } from "@/services/apiBaseUrl";
import { API_URL } from "@/services/apiClient";
import {
  deleteAwsSetupProfile,
  getActiveAwsSetup,
  listAwsSetupProfiles,
  saveAwsSetupProfile,
  setActiveAwsSetup,
  type AwsSetupProfile,
} from "@/services/awsSetupStorage";

interface SetupFormState {
  accessKeyId: string;
  backendUrl: string;
  instanceId: string;
  instanceName: string;
  label: string;
  notes: string;
  region: string;
  secretAccessKey: string;
  sessionToken: string;
}

const DEFAULT_FORM: SetupFormState = {
  accessKeyId: "",
  backendUrl: normalizeApiBaseUrl(API_URL),
  instanceId: "",
  instanceName: "",
  label: "",
  notes: "",
  region: "",
  secretAccessKey: "",
  sessionToken: "",
};

export default function AwsSetupScreen() {
  const router = useRouter();
  const [form, setForm] = useState<SetupFormState>(DEFAULT_FORM);
  const [profiles, setProfiles] = useState<AwsSetupProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refreshProfiles = useCallback(async () => {
    const [savedProfiles, activeProfile] = await Promise.all([
      listAwsSetupProfiles(),
      getActiveAwsSetup(),
    ]);

    setProfiles(savedProfiles);
    setActiveProfileId(activeProfile?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshProfiles();
    }, [refreshProfiles]),
  );

  const isOnboarding = !profiles.length && !activeProfileId;

  const handleSave = useCallback(async () => {
    if (!form.backendUrl.trim()) {
      setErrorMessage("Enter a monitoring URL before saving this connection.");
      setStatusMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const normalizedBackendUrl = normalizeApiBaseUrl(form.backendUrl);
      const savedProfile = await saveAwsSetupProfile({
        accessKeyId: form.accessKeyId,
        backendUrl: normalizedBackendUrl,
        instanceId: form.instanceId,
        instanceName: form.instanceName,
        label: form.label,
        notes: form.notes,
        region: form.region,
        secretAccessKey: form.secretAccessKey,
        sessionToken: form.sessionToken,
      });

      await saveApiBaseUrl(savedProfile.backendUrl);
      setForm({
        ...DEFAULT_FORM,
        backendUrl: normalizedBackendUrl,
      });
      setStatusMessage(`Saved ${savedProfile.label} on this device.`);
      await refreshProfiles();

      if (isOnboarding) {
        router.replace(TABS_ROOT_ROUTE);
      }
    } catch {
      setErrorMessage("Unable to save this monitoring connection on the device.");
      setStatusMessage(null);
    } finally {
      setIsSaving(false);
    }
  }, [form, isOnboarding, refreshProfiles, router]);

  const handleUseProfile = useCallback(
    async (id: string) => {
      const selectedProfile = profiles.find((profile) => profile.id === id);
      if (!selectedProfile) {
        return;
      }

      const shouldFinishOnboarding = !activeProfileId;

      await Promise.all([
        setActiveAwsSetup(id),
        saveApiBaseUrl(selectedProfile.backendUrl),
      ]);

      setStatusMessage(`${selectedProfile.label} is now the active connection.`);
      setErrorMessage(null);
      await refreshProfiles();

      if (shouldFinishOnboarding) {
        router.replace(TABS_ROOT_ROUTE);
      }
    },
    [activeProfileId, profiles, refreshProfiles, router],
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      await deleteAwsSetupProfile(id);
      const nextActiveProfile = await getActiveAwsSetup();

      if (nextActiveProfile?.backendUrl) {
        await saveApiBaseUrl(nextActiveProfile.backendUrl);
      }

      setStatusMessage("Saved monitoring connection removed.");
      setErrorMessage(null);
      await refreshProfiles();
    },
    [refreshProfiles],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {isOnboarding ? (
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Step 3 of 3</Text>
            </View>
          ) : null}

          <Text style={styles.eyebrow}>
            {isOnboarding ? "Connection" : "Saved connections"}
          </Text>
          <Text style={styles.title}>
            {isOnboarding
              ? "Connect your monitoring endpoint"
              : "AWS Monitoring Connections"}
          </Text>
          <Text style={styles.subtitle}>
            {isOnboarding
              ? "Finish setup by saving the monitoring URL this device should use. Instance ids, region, and credentials are optional."
              : "Manage the monitoring endpoints this device can use. Only the monitoring URL is required for a saved connection."}
          </Text>
        </View>

        <StatusBanner
          title={isOnboarding ? "Required to finish setup" : "Stored on device"}
          message={
            isOnboarding
              ? "The app needs one monitoring URL before the Instances tab can load live data."
              : "Monitoring URLs, optional AWS credentials, and any saved instance notes remain on this device only."
          }
        />

        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>Connection requirements</Text>
          <Text style={styles.requirementsLine}>
            Required: monitoring URL
          </Text>
          <Text style={styles.requirementsLine}>
            Optional: setup name, region, instance id, instance name, access key,
            secret key, session token, and notes
          </Text>
        </View>

        {statusMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isOnboarding ? "Add your first connection" : "Add another connection"}
          </Text>

          <View style={styles.fieldGrid}>
            <FormField
              autoCapitalize="none"
              keyboardType="url"
              label="Monitoring URL"
              placeholder="http://192.168.x.x:5000/monitoring"
              value={form.backendUrl}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, backendUrl: value }))
              }
            />

            <FormField
              label="Setup name"
              optional
              placeholder="Production monitoring"
              value={form.label}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, label: value }))
              }
            />

            <FormField
              label="Region"
              optional
              placeholder="us-east-2"
              value={form.region}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, region: value }))
              }
            />

            <FormField
              autoCapitalize="none"
              label="Instance ID"
              optional
              placeholder="i-0123456789abcdef0"
              value={form.instanceId}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, instanceId: value }))
              }
            />

            <FormField
              label="Instance name"
              optional
              placeholder="api-server-1"
              value={form.instanceName}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, instanceName: value }))
              }
            />

            <FormField
              autoCapitalize="characters"
              label="Access key ID"
              optional
              value={form.accessKeyId}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, accessKeyId: value }))
              }
            />

            <FormField
              autoCapitalize="none"
              label="Secret access key"
              optional
              secureTextEntry
              value={form.secretAccessKey}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, secretAccessKey: value }))
              }
            />

            <FormField
              autoCapitalize="none"
              label="Session token"
              optional
              secureTextEntry
              value={form.sessionToken}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, sessionToken: value }))
              }
            />

            <FormField
              label="Notes"
              multiline
              optional
              placeholder="Team, environment, or account context"
              value={form.notes}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, notes: value }))
              }
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isSaving && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving
                ? "Saving..."
                : isOnboarding
                  ? "Save & Finish Setup"
                  : "Save connection"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.savedHeader}>
            <Text style={styles.cardTitle}>Saved connections</Text>
            <Text style={styles.savedCount}>{profiles.length}</Text>
          </View>

          {!profiles.length ? (
            <Text style={styles.emptyText}>
              No monitoring connections are saved yet. Add a monitoring URL above
              to give the app a default live endpoint.
            </Text>
          ) : (
            profiles.map((profile) => {
              const isActive = profile.id === activeProfileId;
              const summary = formatConnectionSummary(profile);

              return (
                <View key={profile.id} style={styles.profileCard}>
                  <View style={styles.profileHeader}>
                    <View style={styles.profileCopy}>
                      <Text style={styles.profileLabel}>{profile.label}</Text>
                      <Text style={styles.profileMeta}>{summary}</Text>
                      <Text style={styles.profileMeta}>
                        Monitoring URL: {profile.backendUrl}
                      </Text>
                    </View>

                    {isActive ? (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.profileBody}>
                    {profile.accessKeyId ? (
                      <Text style={styles.profileLine}>
                        Access key: {maskSecret(profile.accessKeyId)}
                      </Text>
                    ) : null}

                    {profile.secretAccessKey ? (
                      <Text style={styles.profileLine}>
                        Secret key: {maskSecret(profile.secretAccessKey)}
                      </Text>
                    ) : null}

                    {profile.sessionToken ? (
                      <Text style={styles.profileLine}>
                        Session token: {maskSecret(profile.sessionToken)}
                      </Text>
                    ) : null}

                    {profile.instanceName ? (
                      <Text style={styles.profileLine}>
                        Instance name: {profile.instanceName}
                      </Text>
                    ) : null}

                    {profile.notes ? (
                      <Text style={styles.profileLine}>
                        Notes: {profile.notes}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void handleUseProfile(profile.id);
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isActive ? "In Use" : "Use Connection"}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void handleDeleteProfile(profile.id);
                      }}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.deleteButtonPressed,
                      ]}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  multiline = false,
  optional = false,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  optional?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? " (optional)" : ""}
      </Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
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

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 6) {
    return "••••••";
  }

  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-2)}`;
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
    gap: 8,
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
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
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
  requirementsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9E4FF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  requirementsLine: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  successBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  successText: {
    fontSize: 13,
    color: "#166534",
  },
  errorBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#991B1B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D9E4FF",
    gap: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  fieldGrid: {
    gap: 14,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedCount: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  profileCard: {
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  profileMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  activeBadge: {
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  profileBody: {
    gap: 6,
  },
  profileLine: {
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 14,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  deleteButton: {
    minWidth: 92,
    minHeight: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
  },
  deleteButtonPressed: {
    opacity: 0.88,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B91C1C",
  },
});
