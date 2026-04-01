import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { TABS_GROUP_NAME } from "@/navigation/routes";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";

export const unstable_settings = {
  anchor: TABS_GROUP_NAME,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void hydrateApiBaseUrl();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name={TABS_GROUP_NAME} options={{ headerShown: false }} />
        <Stack.Screen name="aws-setups" options={{ title: "AWS Setups" }} />
        <Stack.Screen
          name="instance/[id]"
          options={{ title: "Instance Detail" }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
