// @ts-check

/**
 * @typedef {import("expo/config").ExpoConfig["android"] & {
 *   usesCleartextTraffic?: boolean;
 * }} AndroidConfigWithCleartext
 */

/** @type {AndroidConfigWithCleartext} */
const androidConfig =  {
  adaptiveIcon: {
    foregroundImage: "./assets/adaptive-icon.png",
    backgroundColor: "#ffffff",
  },
  edgeToEdgeEnabled: true,
  predictiveBackGestureEnabled: false,
  usesCleartextTraffic: true,
};

export default androidConfig;
