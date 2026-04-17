# iOS App Documentation

**Project:** Cloud Infrastructure Monitoring Project, Team 5  

> **Current state:** the iOS client is an Expo Router / React Native app with a working onboarding flow, local PIN and Face ID support, saved AWS monitoring connections, a live EC2 instances dashboard, cached monitoring data, detail pages with CloudWatch trends, and instance power controls.

## 1. Overview

This document describes the current iOS implementation that lives under `apps/mobile` in the repository. The app is designed as the mobile client for the AWS cloud monitoring project. It is not just a scaffold anymore. The codebase already includes authentication-style onboarding, secure local storage, saved endpoint profiles, monitoring overview and detail screens, auto-refresh, cached fallback behavior, and basic EC2 power actions.

This documentation is aligned to the repository as it exists today, so it can replace older placeholder notes that still describe the mobile app as planned work.

## 2. Scope and Current Capabilities

| Area | Status | Notes |
|---|---|---|
| Onboarding | Implemented | Splash route, local PIN setup, optional Face ID, and required monitoring connection before entering the main tabs. |
| Instance list | Implemented | Live overview of EC2 instances with search, state filtering, favorites, refresh status, and cached fallback. |
| Instance detail | Implemented | CPU, memory, network trends by range, cached trend recovery, and start/stop/reboot actions. |
| Settings | Implemented | Lock app, toggle biometrics, reset local sign-in, inspect active monitoring profile, manage saved setups. |
| Saved connections | Implemented | Multiple monitoring profiles can be stored locally and one profile can be made active. |
| Offline resilience | Implemented | Overview and instance responses are cached on device; historical trend snapshots are persisted locally. |
| OpenAPI client | Partially implemented | Shared package exists and is used, but generated schema types are still a placeholder. |
| Production hardening | Partial | Development conveniences such as arbitrary HTTP loads are enabled for iOS; app still needs release hardening. |

## 3. End-to-End User Flow

1. **Launch:** the root route `/` shows a short splash / transition screen and decides where the user should go next.
2. **Step 1, device PIN:** if no PIN exists, the user creates and confirms a 4-digit local PIN on `/sign-in`.
3. **Step 2, biometrics:** `/device-security` lets the user enable Face ID on iOS or continue with PIN only.
4. **Step 3, monitoring connection:** `/aws-setups` requires at least one saved monitoring URL before the app enters the main product flow.
5. **Main app tabs:** after setup, the user lands on `/(tabs)/index` for the Instances screen and can also open `/(tabs)/settings`.
6. **Instance monitoring:** selecting an instance opens `/instance/[id]`, which loads live metrics for the selected time range and falls back to cached data when needed.

## 4. Screen Documentation

| Route | Screen | Purpose and behavior |
|---|---|---|
| `/` | Splash / route resolver | Shows branding briefly, checks local auth state and whether an active monitoring setup exists, then redirects. |
| `/sign-in` | PIN setup / unlock | Creates the device PIN on first run or verifies the saved PIN on later launches. Attempts biometric unlock automatically when enabled. |
| `/device-security` | Biometric preference | Allows the user to enable Face ID on iOS or continue with PIN only. This is step 2 of onboarding. |
| `/aws-setups` | Monitoring connection setup | Stores one or more monitoring profiles. Monitoring URL is required. Region, instance metadata, notes, and AWS credentials are optional. |
| `/(tabs)/index` | Instances list | Loads the EC2 overview, auto-refreshes every 30 seconds while active, supports search/filter/favorites, and shows cached results when live fetches fail. |
| `/instance/[id]` | Instance detail | Shows current state, summary metrics, trend charts for 1h/6h/24h/7d, and start/stop/reboot actions when allowed by state. |
| `/(tabs)/settings` | Settings | Locks the app, toggles Face ID, resets local sign-in, shows the active connection, and opens setup management. |

## 5. Architecture

**High-level flow**

```text
iOS UI (Expo Router screens and components)
    -> local service layer (auth, setups, cache, base URL)
    -> shared `packages/api-client`
    -> backend API
    -> AWS EC2 / CloudWatch / S3
```

- **Routing layer:** file-based routes live under `apps/mobile/app` and use Expo Router.
- **Presentation layer:** shared UI blocks live under `apps/mobile/components`.
- **Stateful behavior:** local auth and background lock logic are wrapped in `providers/local-auth-provider.tsx`.
- **Services layer:** API endpoint selection, local secure storage, favorites, cache files, and metrics history are managed under `apps/mobile/services`.
- **Shared API package:** `packages/api-client` normalizes backend responses and exposes typed helper functions such as `fetchMonitoringOverview`, `fetchInstanceMonitoring`, and `controlInstancePower`.
- **Backend contract currently used by mobile:** `GET /monitoring` and `POST /instances/:instanceId/power` from `aws/backend/server.js`.

## 6. API and Data Behavior

| Endpoint | Used for | Behavior in app |
|---|---|---|
| `GET /monitoring` | Monitoring overview | Returns region, timestamp, status, alarms, and an instance array with summary fields and metric series. Supports `range` values such as 15m, 1h, 6h, 24h, and 7d on the backend. |
| `POST /instances/:instanceId/power` | Power control | Accepts `start`, `stop`, or `reboot` in the request body. The detail screen only enables actions that match the visible instance state. |

Additional notes:

- The default API base URL comes from the shared API package and points to `http://3.134.116.3:5000`, but the app can override this through `EXPO_PUBLIC_API_URL` or through saved monitoring profiles.
- The overview screen refreshes automatically every 30 seconds while the screen is focused and the app is active.
- The detail screen supports time ranges of `1h`, `6h`, `24h`, and `7d`. When no live trend data is available, the screen can reconstruct a partial view from cached data and device-side metrics history.

## 7. Local Storage, Cache, and Security

| Data | Storage | Primary file | Notes |
|---|---|---|---|
| Device PIN | Expo SecureStore | `services/localAuthStorage.ts` | Stored locally only; 4 digits; used to unlock app access. |
| Biometric unlock token and preference | Expo SecureStore | `services/localAuthStorage.ts` | Protected with authentication on supported devices; app uses token presence rather than handling raw biometric data. |
| Saved monitoring profiles | Expo SecureStore | `services/awsSetupStorage.ts` | Stores monitoring URL plus optional AWS metadata and credentials for this device. |
| Active API base URL | Expo SecureStore | `services/apiBaseUrl.ts` | Normalizes the chosen monitoring URL and keeps the shared client aligned. |
| Favorite instances | SecureStore or memory fallback | `services/favoriteInstances.ts` | Pins important instances to the top of the overview. |
| Monitoring cache files | Expo FileSystem | `services/monitoringCache.ts` | Persists overview and instance responses for up to 7 days. |
| Metrics history files | Expo FileSystem | `services/metricsHistory.ts` | Stores trend samples locally to help rebuild charts and summaries. |

Additional security behavior:

- When the app moves to the background and a PIN has been configured, the local auth provider locks the session again.
- Saved monitoring connections are local to the device. The current product flow only requires a monitoring URL, even though the setup form can store optional AWS account fields.
- File-based monitoring cache and metrics history are used for resilience, not as a source of truth. Live API responses always take priority when available.

## 8. iOS-Specific Implementation Notes

| Item | Current value | Why it matters |
|---|---|---|
| Workflow | Expo app with checked-in `ios/` native folder | Expo Router powers the JS app, but the repository also includes native iOS project files for simulator or device builds. |
| Bundle identifier | `com.anonymous.mobile` | Defined in `platforms/ios/app.config.js`. |
| Biometric UX label | Face ID | The local auth layer labels biometrics as Face ID on iOS. |
| Transport policy | Arbitrary loads enabled | ATS allows plain HTTP requests in the current config so local or non-HTTPS monitoring endpoints can be reached during development. |
| Secure storage | Expo SecureStore | Used for PIN, unlock token, active endpoint, and saved setup profiles. |
| Native runtime | Hermes + New Architecture | Enabled through `ios/Podfile.properties.json` and Expo config. |
| Face ID permission | `NSFaceIDUsageDescription` present | Info.plist includes a user-facing reason string. |
| Orientation | Portrait on iPhone; broader support on iPad | Defined in generated iOS project configuration. |

## 9. Setup and Run Instructions for iOS

Recommended developer flow:

1. From the repository root, run `npm run setup` to install dependencies, build the shared API client package, and install the backend dependencies.
2. Start the mobile app with `npm run dev:mobile` from the repository root, or run `npm install` and `npx expo start --ios` inside `apps/mobile`.
3. If the native iOS build path is needed, use `npm run ios:native --prefix ./apps/mobile` or `npx expo run:ios --no-bundler` from `apps/mobile`.
4. Start the backend with `npm run start:server` from the repository root, or `npm start` inside `aws/backend`.
5. If the monitoring API runs at a different address, either set `EXPO_PUBLIC_API_URL` or save a different monitoring URL from the app's AWS Setups screen.

```bash
npm run setup
npm run start:server
npm run dev:mobile

# or inside apps/mobile
npx expo start --ios
```

## 10. Folder Guide

| Path | Responsibility |
|---|---|
| `apps/mobile/app` | Top-level routes and screens for onboarding, tabs, settings, and instance detail. |
| `apps/mobile/components` | Reusable UI pieces such as cards, charts, selectors, and status banners. |
| `apps/mobile/providers` | Cross-screen state, especially local auth and lock behavior. |
| `apps/mobile/hooks` | Shared hooks such as auto-refresh and theme helpers. |
| `apps/mobile/services` | Local storage, cache, auth, endpoint configuration, favorites, and helper APIs. |
| `apps/mobile/ios` | Native iOS project files generated for the current Expo workflow. |
| `packages/api-client` | Shared typed API layer consumed by mobile and intended to support other clients as well. |
| `aws/backend` | Express backend that talks to AWS and returns the monitoring payloads consumed by the app. |
