import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { StatusBanner } from "@/components/StatusBanner";
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
  label: string;
  region: string;
  backendUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  instanceId: string;
  instanceName: string;
  notes: string;
}

const DEFAULT_FORM: SetupFormState = {
  label: "",
  region: "us-east-2",
  backendUrl: API_URL.replace(/\/+$/, ""),
  accessKeyId: "",
  secretAccessKey: "",
  sessionToken: "",
  instanceId: "",
  instanceName: "",
  notes: "",
};

export default function AwsSetupScreen() {
  const [form, setForm] = useState<SetupFormState>(DEFAULT_FORM);
  const [profiles, setProfiles] = useState<AwsSetupProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void refreshProfiles();
  }, []);

  async function refreshProfiles() {
    const [savedProfiles, activeProfile] = await Promise.all([
      listAwsSetupProfiles(),
      getActiveAwsSetup(),
    ]);

    setProfiles(savedProfiles);
    setActiveProfileId(activeProfile?.id ?? null);
  }

  async function handleSave() {
    const missingRequiredField =
      !form.label.trim() ||
      !form.region.trim() ||
      !form.backendUrl.trim() ||
      !form.accessKeyId.trim() ||
      !form.secretAccessKey.trim() ||
      !form.instanceId.trim();

    if (missingRequiredField) {
      setErrorMessage(
        "Fill in the setup name, region, backend URL, credentials, and instance id before saving.",
      );
      setStatusMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const savedProfile = await saveAwsSetupProfile({
        label: form.label,
        region: form.region,
        backendUrl: form.backendUrl,
        accessKeyId: form.accessKeyId,
        secretAccessKey: form.secretAccessKey,
        sessionToken: form.sessionToken,
        instanceId: form.instanceId,
        instanceName: form.instanceName,
        notes: form.notes,
      });

      setForm(DEFAULT_FORM);
      setStatusMessage(`Saved setup for ${savedProfile.label}.`);
      await refreshProfiles();
    } catch {
      setErrorMessage("Unable to save this AWS setup on the device.");
      setStatusMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUseProfile(id: string) {
    await setActiveAwsSetup(id);
    setStatusMessage("Active AWS setup updated.");
    setErrorMessage(null);
    await refreshProfiles();
  }

  async function handleDeleteProfile(id: string) {
    await deleteAwsSetupProfile(id);
    setStatusMessage("Saved AWS setup removed.");
    setErrorMessage(null);
    await refreshProfiles();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Setup</Text>
        <Text style={styles.title}>AWS Instance Configuration</Text>
        <Text style={styles.subtitle}>
          Save the connection details, backend URL, and credentials you expect
          to use once the live AWS flow is wired end to end.
        </Text>
      </View>

      <StatusBanner
        title="Local only"
        message="These values are stored on this device. The backend still needs matching AWS credentials configured separately before live calls will succeed."
      />

      {statusMessage && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{statusMessage}</Text>
        </View>
      )}

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add AWS Setup</Text>
        <View style={styles.fieldGrid}>
          <FormField
            label="Setup name"
            placeholder="Dev account"
            value={form.label}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, label: value }))
            }
          />
          <FormField
            label="Region"
            placeholder="us-east-2"
            value={form.region}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, region: value }))
            }
          />
          <FormField
            label="Backend URL"
            placeholder="http://192.168.x.x:4000"
            keyboardType="url"
            autoCapitalize="none"
            value={form.backendUrl}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, backendUrl: value }))
            }
          />
          <FormField
            label="Access key ID"
            autoCapitalize="characters"
            value={form.accessKeyId}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, accessKeyId: value }))
            }
          />
          <FormField
            label="Secret access key"
            secureTextEntry
            autoCapitalize="none"
            value={form.secretAccessKey}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, secretAccessKey: value }))
            }
          />
          <FormField
            label="Session token"
            secureTextEntry
            autoCapitalize="none"
            value={form.sessionToken}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, sessionToken: value }))
            }
          />
          <FormField
            label="Instance ID"
            autoCapitalize="none"
            value={form.instanceId}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, instanceId: value }))
            }
          />
          <FormField
            label="Instance name"
            value={form.instanceName}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, instanceName: value }))
            }
          />
          <FormField
            label="Notes"
            placeholder="Role, environment, or account notes"
            multiline
            value={form.notes}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, notes: value }))
            }
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            isSaving && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving…" : "Save setup"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.savedHeader}>
          <Text style={styles.cardTitle}>Saved Setups</Text>
          <Text style={styles.savedCount}>{profiles.length}</Text>
        </View>

        {!profiles.length ? (
          <Text style={styles.emptyText}>
            No AWS setups saved yet. Add one above so the app has the instance
            and credential details you plan to use.
          </Text>
        ) : (
          profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;

            return (
              <View key={profile.id} style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.profileCopy}>
                    <Text style={styles.profileLabel}>{profile.label}</Text>
                    <Text style={styles.profileMeta}>
                      {profile.region} · {profile.instanceId}
                    </Text>
                    <Text style={styles.profileMeta}>
                      Backend: {profile.backendUrl}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>

                <View style={styles.profileBody}>
                  <Text style={styles.profileLine}>
                    Access key: {maskSecret(profile.accessKeyId)}
                  </Text>
                  <Text style={styles.profileLine}>
                    Secret key: {maskSecret(profile.secretAccessKey)}
                  </Text>
                  {profile.sessionToken && (
                    <Text style={styles.profileLine}>
                      Session token: {maskSecret(profile.sessionToken)}
                    </Text>
                  )}
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
                    onPress={() => void handleUseProfile(profile.id)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isActive ? "In use" : "Use setup"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleDeleteProfile(profile.id)}
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
  );
}

function FormField({
  label,
  multiline = false,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 6) {
    return "••••••";
  }

  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-2)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2563EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
  successBanner: {
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#0F172A",
    paddingVertical: 14,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedCount: {
    minWidth: 32,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 16,
    gap: 12,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  profileMeta: {
    fontSize: 13,
    color: "#64748B",
  },
  activeBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#1D4ED8",
  },
  profileBody: {
    gap: 4,
  },
  profileLine: {
    fontSize: 13,
    lineHeight: 18,
    color: "#334155",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  deleteButton: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  deleteButtonPressed: {
    opacity: 0.92,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B91C1C",
  },
});
