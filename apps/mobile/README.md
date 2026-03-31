# Mobile App (Expo)

This is the mobile app for the Cloud Infrastructure Monitoring project. It uses Expo with file-based routing (Expo Router) and currently renders the EC2 Instances list using mock data.

## Quick Start

1. Install dependencies

   ```bash
   npm install
   ```

2. Start Expo

   ```bash
   npx expo start
   ```

3. Open iOS from Expo

   ```bash
   npx expo start --ios
   ```

   Or start Expo once and press `i` in the terminal.

4. If you need tunnel mode for a physical device, use:

   ```bash
   npx expo start --tunnel
   ```

## Current Screen

- Instances list (EC2 name, ID, state, type): `app/(tabs)/index.tsx`
- Instance detail + CPU chart: `app/instance/[id].tsx`
- Mock data source: `data/mockInstances.ts`
- CPU mock data: `data/mockCpuSeries.ts`
- Card component: `components/InstanceCard.tsx`
- Chart component: `components/CpuUsageChart.tsx`
- Types: `types/instances.ts`

## Project Structure

- `app/` — file-based routes (Expo Router)
- `components/` — shared UI components
- `data/` — mock data and local fixtures

- `services/` — API helpers and backend integration
- `types/` — shared TypeScript types
- `assets/` — images and fonts

## CloudWatch Metrics API

- Client: `services/cloudWatchApi.ts`
- Endpoint: `GET /monitoring` (from `aws/backend/server.js`)
- Base URL: set `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:5000`)


## Next Step (API Wiring)

Replace `mockInstances` with real data once the OpenAPI client is ready, and connect the screen to the backend.

## Troubleshooting

- If Expo is not loading correctly, stop Metro and restart from `apps/mobile` with `npx expo start -c`.
- Use `npx expo start --ios` for simulator launches and `npx expo start --tunnel` for physical devices.
- If you specifically need the custom native iOS build, use `npx expo run:ios` or `npm run ios:native`.
- If the monitoring API is only available over plain `http://...`, Expo Go on iOS may still block it. In that case use the native build path instead of Expo Go.
- Make sure Metro is running from this folder: `.../SER517-Team5/apps/mobile`.

## Learn More

- Expo Router docs: https://docs.expo.dev/router/introduction/
- Expo docs: https://docs.expo.dev/
