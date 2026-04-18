# SER 517 Team 5 - iOS App Validation and Functional Readiness Report

**Project:** Cloud Infrastructure Monitoring  
**Platform:** iOS mobile application  
**Repository scope reviewed:** `apps/mobile`, `packages/api-client`, and AWS backend integration used by the mobile flow

## Executive summary

The iOS application is operating as intended for the current capstone scope. Core user flows, backend integration points, state refresh behavior, secure local setup handling, and instance control actions are functioning in alignment with the implemented product design.

Validation confirms that the app supports the full expected monitoring journey: onboarding, device security selection, monitoring endpoint setup, live instance overview, instance detail inspection, refresh behavior, and instance power control actions. The current build is suitable for live demonstration, sprint closure reporting, and continued team use.

## Validated service contract

The iOS app is aligned with the current monitoring service contract:

- Base monitoring endpoint: `http://16.59.20.106:5000/monitoring`
- Read endpoint: `GET /monitoring`
- Power endpoint: `POST /instances/:instanceId/power`

Request body for power controls:

```json
{
  "action": "start" | "stop" | "reboot"
}
```

The implemented mobile flow supports this contract correctly and uses refresh behavior to surface updated instance state after control actions.

## Validation outcome summary

| Validation area | Outcome | Status |
|---|---|---|
| App launch, route guard, and onboarding sequence | Verified and functioning | Pass |
| PIN creation, unlock flow, and local sign-in persistence | Verified and functioning | Pass |
| Biometric preference enable or skip flow | Verified and functioning | Pass |
| AWS setup save, switch, activate, and delete actions | Verified and functioning | Pass |
| Monitoring URL hydration into active API configuration | Verified and functioning | Pass |
| Instances tab live load and status handling | Verified and functioning | Pass |
| Search, state filters, favorites, and favorites-only view | Verified and functioning | Pass |
| Manual refresh and automatic refresh behavior | Verified and functioning | Pass |
| Cached overview and cached metrics fallback behavior | Verified and functioning | Pass |
| Instance detail metrics screen and time range switching | Verified and functioning | Pass |
| Power actions for start, stop, and reboot | Verified and functioning | Pass |
| Post-action refresh and updated state visibility | Verified and functioning | Pass |
| Settings controls and security-state management | Verified and functioning | Pass |
| iOS native project readiness and mobile packaging | Verified and functioning | Pass |

## Functional validation details

### 1. App entry and onboarding flow

The entry flow correctly routes the user through the intended sequence instead of dropping directly into the monitoring screens.

Observed working behavior:

- first launch routes through setup screens,
- PIN creation is enforced before protected access,
- biometric preference is handled before normal app access,
- monitoring setup is captured before opening the main tabs,
- returning users are routed according to saved local state.

This confirms that onboarding logic is complete and operational.

### 2. Sign-in and device security

The app supports a practical mobile security flow for the capstone scope.

Validated behavior includes:

- four-digit PIN creation and confirmation,
- PIN unlock for returning users,
- biometric preference enablement or skip path,
- persistence of local sign-in state,
- settings-based lock and reset options.

This security flow is consistent across onboarding and settings and behaves as a complete in-app access layer.

### 3. Monitoring connection setup

The AWS setup screen is functioning as the connection control center for the app.

Validated behavior includes:

- saving a named monitoring configuration,
- storing the monitoring endpoint and optional setup metadata,
- selecting one setup as active,
- switching the active setup without losing saved entries,
- deleting an existing setup cleanly,
- hydrating the active setup into the mobile API configuration.

This allows the app to switch monitoring sources in a structured and repeatable way.

### 4. Instances overview screen

The Instances tab is functioning as the primary operational dashboard.

Validated behavior includes:

- loading monitoring data from the configured endpoint,
- rendering instance cards with live state information,
- handling loading, empty, and refresh states clearly,
- searching by relevant instance attributes,
- filtering by state,
- marking favorites and prioritizing favorites in the list,
- supporting both pull-to-refresh and on-screen refresh behavior,
- maintaining periodic auto-refresh while the screen remains active.

This matches the expected use case for day-to-day instance visibility.

### 5. Instance detail and metrics visibility

The instance detail screen is working as the deeper inspection view for operational monitoring.

Validated behavior includes:

- opening a selected instance from the overview list,
- loading metrics and summary values for the selected instance,
- supporting multiple time windows,
- rendering chart-based metric sections,
- exposing a clear refresh action,
- updating detail data after refresh cycles.

The detail screen is suitable for showing instance health trends and operational state at demo level and team review level.

### 6. Refresh behavior

Refresh behavior is functioning correctly across the monitoring experience.

Validated behavior includes:

- manual refresh from the overview screen,
- manual refresh from the instance detail screen,
- periodic automatic refresh while monitoring screens remain active,
- state refresh after control actions such as reboot or stop,
- continuity of user experience during expected backend update delays.

This is especially important because instance state changes may take a few seconds to appear after a control action. The implemented refresh pattern supports that operational reality.

### 7. Power controls

Power control functionality is working in alignment with the backend contract.

Validated behavior includes:

- sending `start`, `stop`, and `reboot` actions to the correct endpoint,
- enabling only the actions that make sense for the current instance state,
- protecting the action flow with confirmation prompts,
- refreshing the displayed state after the action response,
- surfacing the updated state through subsequent refresh behavior.

This confirms that the app is not only a passive monitoring client, but also a functioning control surface for the supported instance actions.

### 8. Settings and persistence

The Settings tab correctly supports the remaining user-level controls.

Validated behavior includes:

- locking the app immediately,
- toggling biometric preference,
- resetting the local sign-in setup,
- showing active monitoring setup context,
- navigating back to connection management when needed.

Persistence behavior is coherent across security preferences, saved setups, and favorites.

## Live operational readiness

The iOS app is ready for live team use within the current project scope.

Working operational path:

1. Launch the app.
2. Complete PIN and device security setup.
3. Save the monitoring endpoint.
4. Load the instance overview.
5. Search or filter the available instances.
6. Open an instance detail page.
7. Refresh the page and review metrics.
8. Trigger start, stop, or reboot when appropriate.
9. Refresh again and confirm the updated instance state.

This end-to-end path represents the intended demo and validation journey for the mobile deliverable, and the current implementation supports it successfully.

## Conclusion

The iOS application is validated as functionally complete for the implemented monitoring scope. Monitoring retrieval, refresh handling, local setup persistence, metrics display, and instance control actions are all operating in a coherent end-to-end flow.

The build is ready to be presented as a working iOS monitoring client for the SER 517 capstone project.
