import type { Href } from "expo-router";
import type { InstanceState } from "api-client";

export const TABS_GROUP_NAME = "(tabs)";
export const TABS_ROOT_ROUTE = "/(tabs)" as Href;
export const SETTINGS_ROUTE = "/(tabs)/settings" as Href;
export const AWS_SETUPS_ROUTE = "/aws-setups" as Href;
export const DEVICE_SECURITY_ROUTE = "/device-security" as Href;
export const SIGN_IN_ROUTE = "/sign-in" as Href;
const INSTANCE_DETAIL_PATHNAME = "/instance/[id]" as const;

interface InstanceDetailRouteParams {
  id: string;
  name?: string;
  state?: InstanceState;
  type?: string;
  zone?: string;
}

export function buildInstanceDetailRoute(
  params: InstanceDetailRouteParams,
): Href {
  return {
    pathname: INSTANCE_DETAIL_PATHNAME,
    params,
  } as Href;
}
