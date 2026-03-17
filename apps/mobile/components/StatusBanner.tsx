import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface StatusBannerProps {
  title: string;
  message: string;
}

export function StatusBanner({ title, message }: StatusBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDBA74",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#9A3412",
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: "#9A3412",
  },
});
