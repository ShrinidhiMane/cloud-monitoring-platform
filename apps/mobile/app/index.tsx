import { Stack, useRouter } from "expo-router";
import { StyleSheet, View, Animated } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useEffect, useRef } from "react";

const AnimatedThemedView = Animated.createAnimatedComponent(ThemedView);

export default function App() {
  const router = useRouter();
  const translateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateAnim.addListener((animValue: { value: number }) => {
      if (animValue["value"] === 1) {
        router.navigate("/tabs");
      }
    });
    Animated.timing(translateAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();
  }, [translateAnim, router]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.iconHolder}>
        <MaterialCommunityIcons name="aws" size={120} color="red" />
        <AnimatedThemedView
          style={{
            ...styles.arrowAnimate,
            transform: [
              {
                translateX: translateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ],
          }}
        ></AnimatedThemedView>
      </View>
      <ThemedText type="title">Monitoring</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  iconHolder: {
    position: "relative",
  },
  arrowAnimate: {
    position: "absolute",
    top: "55%",
    left: "0%",
    bottom: "0%",
    right: "0%",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
