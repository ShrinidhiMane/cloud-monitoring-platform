# Mobile App (Expo)

This is the mobile app for the Cloud Infrastructure Monitoring project. It uses Expo with file-based routing (Expo Router) and currently renders the EC2 Instances list using mock data.

## Quick Start

1. Install dependencies

   ```bash
   npm install
   ```

2. Start Metro for the development build

   ```bash
   npm start
   ```

   `npm start` uses `localhost`, which is the most reliable option for the iOS simulator.
   If you are running on a physical device, use:

   ```bash
   npm run start:tunnel
   ```

3. Build and open the native iOS app

   ```bash
   npm run ios
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

- If you see `Could not connect to development server`, make sure you are running `npm start` from `apps/mobile` before `npm run ios`.
- The default Metro URL is `http://localhost:8081` for simulator use. If you are on a physical device, use `npm run start:tunnel` instead.
- If you see a white screen, stop Metro and restart from `apps/mobile` with `npx expo start --dev-client --host localhost -c`.
- Make sure Metro is running from this folder: `.../SER517-Team5/apps/mobile`.

## Learn More

- Expo Router docs: https://docs.expo.dev/router/introduction/
- Expo docs: https://docs.expo.dev/
