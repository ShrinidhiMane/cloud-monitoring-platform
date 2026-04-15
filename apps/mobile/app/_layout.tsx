import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  SIGN_IN_ROUTE,
  DEVICE_SECURITY_ROUTE,
  TABS_GROUP_NAME,
  TABS_ROOT_ROUTE,
  AWS_SETUPS_ROUTE,
} from "@/navigation/routes";
import {
  LocalAuthProvider,
  useLocalAuth,
} from "@/providers/local-auth-provider";
import { resolveNextAppRoute, hasConnectedAwsSetup } from "@/services/appOnboarding";
import { hydrateApiBaseUrl } from "@/services/apiBaseUrl";

export const unstable_settings = {
  anchor: TABS_GROUP_NAME,
};

function AuthenticationRoutingGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    hasBiometricPreferenceSet,
    hasPinConfigured,
    isHydrating,
    isUnlocked,
  } = useLocalAuth();
  const [hasActiveAwsSetup, setHasActiveAwsSetup] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    const loadSetupState = async () => {
      const nextValue = await hasConnectedAwsSetup();
      if (!isMounted) {
        return;
      }

      setHasActiveAwsSetup(nextValue);
    };

    void loadSetupState();

    return () => {
      isMounted = false;
    };
  }, [pathname, isUnlocked]);

  useEffect(() => {
    if (isHydrating || hasActiveAwsSetup === null) {
      return;
    }

    const isSplashRoute = pathname === "/";
    const isSignInRoute = pathname === SIGN_IN_ROUTE;
    const isDeviceSecurityRoute = pathname === DEVICE_SECURITY_ROUTE;
    const isAwsSetupRoute = pathname === AWS_SETUPS_ROUTE;
    const nextRoute = resolveNextAppRoute({
      hasActiveAwsSetup,
      hasBiometricPreferenceSet,
      hasPinConfigured,
      isUnlocked,
    });

    if (nextRoute === SIGN_IN_ROUTE) {
      if (!isSplashRoute && !isSignInRoute) {
        router.replace(SIGN_IN_ROUTE);
      }
      return;
    }

    if (nextRoute === DEVICE_SECURITY_ROUTE) {
      if (!isSplashRoute && !isDeviceSecurityRoute) {
        router.replace(DEVICE_SECURITY_ROUTE);
      }
      return;
    }

    if (nextRoute === AWS_SETUPS_ROUTE) {
      if (!isSplashRoute && !isAwsSetupRoute) {
        router.replace(AWS_SETUPS_ROUTE);
      }
      return;
    }

    if (isSignInRoute || isDeviceSecurityRoute || isSplashRoute) {
      router.replace(TABS_ROOT_ROUTE);
    }
  }, [
    hasActiveAwsSetup,
    hasBiometricPreferenceSet,
    hasPinConfigured,
    isHydrating,
    isUnlocked,
    pathname,
    router,
  ]);

  return null;
}

function RootNavigator() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void hydrateApiBaseUrl();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthenticationRoutingGuard />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="device-security" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
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

export default function RootLayout() {
  return (
    <LocalAuthProvider>
      <RootNavigator />
    </LocalAuthProvider>
  );
}
