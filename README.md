# Cloud Infrastructure Monitoring

A multi-platform AWS infrastructure monitoring tool built by SER517 Team 5. It provides real-time visibility into EC2 instances, CloudWatch metrics, CloudWatch alarms, S3 bucket storage, and security group details — accessible from both a web browser and a native mobile app.

- **Web:** React + TypeScript + Vite (`apps/web`)
- **Mobile:** Expo / React Native for Android and iOS (`apps/mobile`)
- **Backend:** Express + AWS SDK (`aws/backend`)
- **Shared client/types:** TypeScript package (`packages/api-client`)

---

## Features

- **EC2 Fleet Overview** — view all instances with state, type, availability zone, and IP addresses
- **Live CloudWatch Metrics** — CPU utilization, memory usage (via CloudWatch Agent), network in/out bytes, disk read/write ops
- **Metric Time Range Selection** — query historical data over 15 minutes, 1 hour, 6 hours, 24 hours, or 7 days
- **CloudWatch Alarm Feed** — real-time alarm state sorted by severity (ALARM → INSUFFICIENT\_DATA → OK)
- **Instance-Level Alarm Drilldown** — see which alarms are tied to a specific EC2 instance
- **S3 Bucket Monitoring** — bucket size (bytes) and object count per bucket via CloudWatch
- **Security Group Details** — view security groups associated with each instance
- **EC2 Power Controls** — start, stop, and reboot instances directly from the UI
- **Overall Health Status** — API response includes a `healthy` / `degraded` status derived from active alarms
- **Mobile: AWS Setup Profiles** — save and switch between multiple monitoring endpoint configurations
- **Mobile: Device PIN + Biometric Lock** — 4-digit PIN and Face ID / fingerprint authentication to protect the app locally
- **Mobile: Offline Metric Caching** — cached monitoring responses for use when the API is unreachable
- **Mobile: Auto-Refresh** — configurable background polling to keep metrics up to date
- **Mobile: Favorites** — bookmark frequently accessed instances for quick access

---

## Repository Layout

```text
apps/
  mobile/              Expo app for Android, iOS, and Expo web
  web/                 React + Vite web app
aws/
  backend/             Express backend that proxies AWS SDK calls
  sprint*/             Per-sprint AWS validation scripts and notes
docs/                  Runbooks and project documentation
packages/
  api-client/          Shared API client, alarm helpers, and TypeScript types
```

---

## Prerequisites

Install these on both macOS and Windows:

- Node.js 20 or newer
- npm 10 or newer
- Git

Platform-specific tools:

- **macOS:** Xcode (iOS simulator or native iOS builds), Android Studio (Android emulator)
- **Windows:** Android Studio (Android emulator) — iOS builds are not supported on Windows

AWS access for the backend:

- The backend reads credentials from environment variables (see [Backend AWS Credentials](#backend-aws-credentials) below)
- Reference file: `aws/backend/.env.example` — this file is a scaffold and is **not** auto-loaded at runtime

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/kb019/AWS-Monitoring-Android-App.git
cd AWS-Monitoring-Android-App
```

### 2. Install all workspace dependencies

```bash
npm run setup
```

`npm run setup` will:

1. Install root dependencies
2. Install `apps/web`
3. Install `apps/mobile`
4. Build `packages/api-client`
5. Install `aws/backend`

> If `npm run setup` fails, run `npm install` at the repo root first, then retry `npm run setup`.

---

## Environment Setup

### Web app

Create `apps/web/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Replace `localhost` with your backend's address if the API runs elsewhere.

### Mobile app

The mobile app resolves the backend URL in two ways:

- The `EXPO_PUBLIC_API_URL` environment variable set at launch time
- A saved AWS Setup Profile stored inside the app

For local development, export the variable before starting Expo:

```bash
# macOS / Linux
export EXPO_PUBLIC_API_URL=http://localhost:5000

# Windows PowerShell
$env:EXPO_PUBLIC_API_URL="http://localhost:5000"
```

> **Physical device note:** Do not use `localhost`. Use your machine's LAN IP instead (e.g. `http://192.168.1.25:5000`).

### Backend AWS Credentials

Set these environment variables in the shell before starting the backend:

```bash
# macOS / Linux
export AWS_REGION=us-east-2
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Optional: restrict which EC2 instances the backend will return
export AWS_ALLOWED_INSTANCE_IDS=i-abc123,i-def456
```

```powershell
# Windows PowerShell
$env:AWS_REGION="us-east-2"
$env:AWS_ACCESS_KEY_ID="your_access_key_id"
$env:AWS_SECRET_ACCESS_KEY="your_secret_access_key"
$env:AWS_SESSION_TOKEN="your_session_token"
```

---

## Running the Project

Start each service in its own terminal from the repo root.

### 1. Start the backend

```bash
npm run start:server
```

The backend listens on port `5000` by default.

### 2. Start the web app

```bash
npm run web:dev
```

Open the Vite URL shown in the terminal.

### 3. Start the mobile app

```bash
npm run dev:mobile
```

This starts both the shared `api-client` watcher and the Expo dev server.

Additional mobile launch targets:

```bash
# Android emulator
npm run android --prefix apps/mobile

# iOS simulator (macOS only)
npm run ios --prefix apps/mobile

# Expo web
npm run web --prefix apps/mobile

# Native Android build (no bundler)
npm run android:native --prefix apps/mobile

# Native iOS build — macOS only
npm run ios:native --prefix apps/mobile
```

---

## API Reference

### `GET /monitoring`

Returns the full monitoring snapshot for all EC2 instances, S3 buckets, security groups, and CloudWatch alarms.

**Query parameters:**

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `range` | `15m` `1h` `6h` `24h` `7d` | `1h` | Lookback window for metric series data |

**Response shape (abbreviated):**

```json
{
  "timestamp": "ISO-8601",
  "region": "us-east-2",
  "status": "healthy | degraded",
  "instances": [ /* EC2 instances with metrics */ ],
  "s3": [ /* S3 bucket stats */ ],
  "security": [ /* security group details */ ],
  "alarms": [ /* CloudWatch alarms sorted by severity */ ]
}
```

### `POST /instances/:instanceId/power`

Sends a power action to an EC2 instance.

**Request body:**

```json
{ "action": "start | stop | reboot" }
```

### S3 Routes (`aws/backend/routes/s3Routes.js`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/s3/upload` | Upload a file to the configured S3 bucket |
| `DELETE` | `/s3/:key` | Delete a file from the S3 bucket by key |

S3 routes require `S3_BUCKET` to be set in the environment.

---

## Common Commands

From the repo root:

```bash
# Run all linters
npm run lint

# Run individual linters
npm run lint:webapp
npm run lint:mobile
npm run lint:server

# Auto-fix lint issues
npm run lint:fix-web
npm run lint:fix-mobile
npm run lint:fix-all

# Run backend tests
npm run test --prefix aws/backend
```

---

## CI / CD

A GitHub Actions workflow (`.github/workflows/test-on-pr.yml`) runs automatically on every pull request. It:

1. Checks out the repo and sets up Node.js 20
2. Runs `npm run setup` to install all dependencies and build the shared package
3. Runs `npm run lint` across all workspaces
4. Runs `npm run test` to execute the backend test suite

---

## Platform Notes

### macOS

- Web, Android, and iOS can all be run from one machine
- Xcode is required for iOS simulator and native iOS builds
- If Expo Go cannot reach an `http://` URL on iOS, use a native iOS build instead

### Windows

- Web and Android can be run from one machine
- iOS simulator and native iOS builds are not supported
- Use PowerShell to set environment variables, and point the mobile app at an Android-emulator-accessible backend URL

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm run setup` fails | Run `npm install` at the repo root, then retry `npm run setup` |
| Web app: `Missing VITE_API_URL env var` | Create `apps/web/.env` with `VITE_API_URL=http://localhost:5000` |
| Mobile app can't reach the API | Verify `EXPO_PUBLIC_API_URL` or update the saved monitoring profile in-app |
| Physical device can't connect | Replace `localhost` with your machine's LAN IP address |
| AWS requests fail (403 / credential errors) | Verify that the shell running `npm run start:server` has valid AWS credentials exported |
| Memory metrics missing (`memoryUtilization` is `0`) | The CloudWatch Agent must be installed and running on the EC2 instance |
| S3 metrics missing | Ensure `S3_BUCKET` is set and that the IAM role/user has `s3:GetBucketLocation` and `cloudwatch:GetMetricStatistics` permissions |
