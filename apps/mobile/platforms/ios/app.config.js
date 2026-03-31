// @ts-check

/**
 * @type {import("expo/config").ExpoConfig["ios"]}
 */
const iosConfig = {
  supportsTablet: true,
  bundleIdentifier: "com.anonymous.mobile",
  infoPlist: {
    NSAppTransportSecurity: {
      NSAllowsArbitraryLoads: true,
    },
  },
};

export default iosConfig;
