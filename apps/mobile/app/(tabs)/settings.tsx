import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getConfiguredApiBaseUrl,
  getDefaultApiBaseUrl,
  resetApiBaseUrl,
  saveApiBaseUrl,
  testApiBaseUrl,
} from "@/services/apiBaseUrl";
import { AWS_SETUPS_ROUTE } from "@/navigation/routes";

export default function SettingsScreen() {
  const router = useRouter();
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [savedBaseUrl, setSavedBaseUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Choose the monitoring API URL used for live EC2 data.",
  );
  const [isSaving, setIsSaving] = useState(false);

  const loadCurrentUrl = useCallback(async () => {
    const currentUrl = await getConfiguredApiBaseUrl();
    setApiBaseUrl(currentUrl);
    setSavedBaseUrl(currentUrl);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCurrentUrl();
    }, [loadCurrentUrl]),
  );

  const handleTest = useCallback(async () => {
    setIsSaving(true);
    const result = await testApiBaseUrl(apiBaseUrl);

    if (result.ok) {
      setStatusMessage(`Connected to ${result.normalizedUrl}.`);
    } else {
      setStatusMessage(`Connection failed: ${result.error}`);
    }

    setIsSaving(false);
  }, [apiBaseUrl]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const normalizedUrl = await saveApiBaseUrl(apiBaseUrl);
    setApiBaseUrl(normalizedUrl);
    setSavedBaseUrl(normalizedUrl);

    const result = await testApiBaseUrl(normalizedUrl);
    setStatusMessage(
      result.ok
        ? `Saved ${normalizedUrl} and confirmed the monitoring endpoint is reachable.`
        : `Saved ${normalizedUrl}, but the connection test failed: ${result.error}`,
    );
    setIsSaving(false);
  }, [apiBaseUrl]);

  const handleReset = useCallback(async () => {
    setIsSaving(true);
    const defaultUrl = await resetApiBaseUrl();
    setApiBaseUrl(defaultUrl);
    setSavedBaseUrl(defaultUrl);
    setStatusMessage(`Reset to the default API URL: ${defaultUrl}`);
    setIsSaving(false);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Configure the backend endpoint for live monitoring data.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Monitoring Endpoint</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setApiBaseUrl}
            placeholder="http://3.134.116.3:5000/monitoring"
            style={styles.input}
            value={apiBaseUrl}
          />
          <Text style={styles.helpText}>Default: {getDefaultApiBaseUrl()}</Text>
          <Text style={styles.helpText}>
            Current: {savedBaseUrl || "not set"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Navigation</Text>
          <Text style={styles.helpText}>
            Open the saved AWS setup manager from here instead of keeping it as
            a hidden tab.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.push(AWS_SETUPS_ROUTE);
            }}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonLabel}>Manage AWS Setups</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>
              {isSaving ? "Working..." : "Save URL"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => {
              void handleTest();
            }}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.buttonLabel}>Test Connection</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => {
              void handleReset();
            }}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.buttonLabel}>Reset Default</Text>
          </Pressable>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  helpText: {
    fontSize: 12,
    color: "#64748B",
  },
  actions: {
    gap: 10,
  },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButton: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A",
  },
  primaryButtonLabel: {
    color: "#F8FAFC",
    fontWeight: "700",
  },
  buttonLabel: {
    color: "#0F172A",
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statusText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
});
