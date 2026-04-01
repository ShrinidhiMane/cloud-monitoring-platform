import React from "react";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type ScreenStateVariant = "loading" | "empty" | "error";
type ScreenStateActionTone = "primary" | "secondary";

interface ScreenStateAction {
  label: string;
  onPress: () => void;
  tone?: ScreenStateActionTone;
}

interface ScreenStateCardProps {
  variant: ScreenStateVariant;
  title: string;
  message: string;
  actions?: ScreenStateAction[];
  compact?: boolean;
}

const VARIANT_STYLES: Record<
  ScreenStateVariant,
  {
    backgroundColor: string;
    borderColor: string;
    iconColor: string;
    titleColor: string;
    messageColor: string;
  }
> = {
  loading: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    iconColor: "#2563EB",
    titleColor: "#1D4ED8",
    messageColor: "#1E3A8A",
  },
  empty: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    iconColor: "#64748B",
    titleColor: "#0F172A",
    messageColor: "#475569",
  },
  error: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    iconColor: "#DC2626",
    titleColor: "#991B1B",
    messageColor: "#7F1D1D",
  },
};

const VARIANT_ICONS: Record<
  Exclude<ScreenStateVariant, "loading">,
  ComponentProps<typeof MaterialIcons>["name"]
> = {
  empty: "inbox",
  error: "error-outline",
};

export function ScreenStateCard({
  variant,
  title,
  message,
  actions = [],
  compact = false,
}: ScreenStateCardProps) {
  const palette = VARIANT_STYLES[variant];

  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : styles.cardRegular,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {variant === "loading" ? (
          <ActivityIndicator color={palette.iconColor} />
        ) : (
          <MaterialIcons
            color={palette.iconColor}
            name={VARIANT_ICONS[variant]}
            size={compact ? 20 : 24}
          />
        )}
        <View style={styles.copy}>
          <Text style={[styles.title, { color: palette.titleColor }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: palette.messageColor }]}>
            {message}
          </Text>
        </View>
      </View>

      {actions.length ? (
        <View style={styles.actionsRow}>
          {actions.map((action) => {
            const tone = action.tone ?? "secondary";
            const isPrimary = tone === "primary";

            return (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  isPrimary
                    ? styles.primaryActionButton
                    : styles.secondaryActionButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    isPrimary
                      ? styles.primaryActionLabel
                      : styles.secondaryActionLabel,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  cardRegular: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  cardCompact: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryActionButton: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  secondaryActionButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  primaryActionLabel: {
    color: "#F8FAFC",
  },
  secondaryActionLabel: {
    color: "#334155",
  },
});
