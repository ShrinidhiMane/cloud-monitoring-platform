// @ts-check

/**
 * @type {import("expo/config").ExpoConfig["android"]}
 */
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
