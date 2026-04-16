import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type TimeRangeOption = "1h" | "6h" | "24h" | "7d";

const OPTIONS: TimeRangeOption[] = ["1h", "6h", "24h", "7d"];

interface TimeRangeSelectorProps {
  value: TimeRangeOption;
  onChange: (value: TimeRangeOption) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const isActive = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.button,
              isActive && styles.buttonActive,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#FFFFFF",
  },
  buttonActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  labelActive: {
    color: "#F8FAFC",
  },
});
