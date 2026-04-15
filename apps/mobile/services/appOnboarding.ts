import type { Href } from "expo-router";

import {
  AWS_SETUPS_ROUTE,
  DEVICE_SECURITY_ROUTE,
  SIGN_IN_ROUTE,
  TABS_ROOT_ROUTE,
} from "@/navigation/routes";
import { getActiveAwsSetup } from "@/services/awsSetupStorage";

interface ResolveNextRouteParams {
  hasActiveAwsSetup: boolean;
  hasBiometricPreferenceSet: boolean;
  hasPinConfigured: boolean;
  isUnlocked: boolean;
}

export function resolveNextAppRoute({
  hasActiveAwsSetup,
  hasBiometricPreferenceSet,
  hasPinConfigured,
  isUnlocked,
}: ResolveNextRouteParams): Href {
  if (!hasPinConfigured || !isUnlocked) {
    return SIGN_IN_ROUTE;
  }

  if (!hasBiometricPreferenceSet) {
    return DEVICE_SECURITY_ROUTE;
  }

  if (!hasActiveAwsSetup) {
    return AWS_SETUPS_ROUTE;
  }

  return TABS_ROOT_ROUTE;
}

export async function hasConnectedAwsSetup(): Promise<boolean> {
  const activeSetup = await getActiveAwsSetup();
  return Boolean(activeSetup);
}
