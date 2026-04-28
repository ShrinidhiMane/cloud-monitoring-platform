# Cloud Infrastructure Monitoring

Multi-platform AWS infrastructure monitoring for:

- Web: React + TypeScript (`apps/web`)
- Mobile: Expo / React Native for Android, iOS, and Expo web (`apps/mobile`)
- Backend: Express + AWS SDK (`aws/backend`)
- Shared client/types: TypeScript package (`packages/api-client`)

The current stack can monitor EC2 instances, show CloudWatch metrics, surface CloudWatch alarms, and send EC2 power actions through the backend API.

## Repository Layout

```text
apps/
  mobile/              Expo app for Android, iOS, and web
  web/                 React + Vite web app
aws/
  backend/             Express backend that talks to AWS
docs/                  Runbooks and project documentation
packages/
  api-client/          Shared API client, alarm helpers, and types
```

## Prerequisites

Install these first on both macOS and Windows:

- Node.js 20 or newer
- npm 10 or newer
- Git

Platform-specific tools:

- macOS:
  - Xcode if you want to run the iOS simulator or native iOS builds
  - Android Studio if you want Android emulators
- Windows:
  - Android Studio if you want Android emulators
  - iOS builds are not supported on Windows

AWS access for the backend:

- The backend uses standard AWS SDK credentials from your shell or AWS profile
- Reference file: `aws/backend/.env.example`
- That file is not auto-loaded by the backend runtime

## Download And Install

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd SER517-Team5
```

### 2. Install workspace dependencies

```bash
npm run setup
```

What `npm run setup` does:

- Installs root dependencies
- Installs `apps/web`
- Installs `apps/mobile`
- Builds `packages/api-client`
- Installs `aws/backend`

## Environment Setup

### Web app

Create `apps/web/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Use your backend URL instead of `localhost` if the API runs elsewhere.

### Mobile app

The mobile app can use:

- `EXPO_PUBLIC_API_URL` at launch time
- A saved monitoring URL inside the app's AWS setup flow

For local development, point it at your backend:

- macOS / Linux:

```bash
export EXPO_PUBLIC_API_URL=http://localhost:5000
```

- Windows PowerShell:

```powershell
$env:EXPO_PUBLIC_API_URL="http://localhost:5000"
```

If you run the app on a physical phone, do not use `localhost`. Use your computer's LAN IP, for example `http://192.168.1.25:5000`.

### Backend AWS credentials

Set AWS credentials in the shell before starting the backend.

- macOS / Linux:

```bash
export AWS_REGION=us-east-2
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
export AWS_SESSION_TOKEN=your_session_token
```

- Windows PowerShell:

```powershell
$env:AWS_REGION="us-east-2"
$env:AWS_ACCESS_KEY_ID="your_access_key_id"
$env:AWS_SECRET_ACCESS_KEY="your_secret_access_key"
$env:AWS_SESSION_TOKEN="your_session_token"
```

If you are using long-lived keys without a session token, you can omit `AWS_SESSION_TOKEN`.

## Running The Repository

### Start the backend

From the repo root:

```bash
npm run start:server
```

The backend listens on port `5000` by default.

### Start the web app

In a second terminal from the repo root:

```bash
npm run web:dev
```

Open the Vite URL shown in the terminal.

### Start the mobile app

In a third terminal from the repo root:

```bash
npm run dev:mobile
```

That starts Expo and the shared API client watcher.

Useful mobile launch commands:

- Android:

```bash
npm run android --prefix apps/mobile
```

- iOS on macOS only:

```bash
npm run ios --prefix apps/mobile
```

- Expo web:

```bash
npm run web --prefix apps/mobile
```

Native Expo builds:

- Android native:

```bash
npm run android:native --prefix apps/mobile
```

- iOS native on macOS only:

```bash
npm run ios:native --prefix apps/mobile
```

## Typical Development Workflow

1. Start the backend with valid AWS credentials.
2. Set `VITE_API_URL` for the web app.
3. Set `EXPO_PUBLIC_API_URL` for the mobile app, or save the monitoring URL in-app.
4. Run the web app with `npm run web:dev`.
5. Run the mobile app with `npm run dev:mobile`.
6. Open:
   - `apps/web` in a browser
   - `apps/mobile` in Android, iOS, or Expo web

## Common Commands

From the repo root:

```bash
npm run lint
npm run lint:webapp
npm run lint:mobile
npm run lint:server
```

## Platform Notes

### macOS

- You can run web, Android, and iOS from one machine
- Xcode is required for iOS simulator or native iOS builds
- If Expo Go cannot reach an `http://` backend on iOS, use a native iOS build instead

### Windows

- You can run web and Android from one machine
- iOS simulator/native iOS builds are not available on Windows
- Use PowerShell environment variables or the Android emulator's network-accessible backend URL

## Troubleshooting

- If `npm run setup` fails, rerun `npm install` at the root and then rerun `npm run setup`
- If the web app says `Missing VITE_API_URL env var`, create `apps/web/.env`
- If the mobile app cannot reach the API, verify `EXPO_PUBLIC_API_URL` or update the saved monitoring profile in the app
- If a physical device cannot connect, replace `localhost` with your machine's LAN IP
- If AWS requests fail, verify the shell session that started `npm run start:server` contains valid AWS credentials

## Current Features

- EC2 fleet overview
- CloudWatch metric history
- CloudWatch alarm feed
- Instance-level alarm drilldown
- EC2 start, stop, and reboot controls
- Cached monitoring responses on mobile
