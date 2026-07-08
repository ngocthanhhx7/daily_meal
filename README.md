# Daily Meal

Daily Meal is a TypeScript monorepo with an Expo React Native client and a Node.js Express API.

## Structure

- `client/` - Expo React Native app.
- `server/` - Express, MongoDB, Gemini, uploads API.

## Quick Start

Use `npm.cmd` on this Windows environment:

```powershell
npm.cmd install
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (!(Test-Path client/.env)) { Copy-Item client/.env.example client/.env }
npm.cmd run dev:server
npm.cmd run dev:client
```

For Expo web at `http://localhost:8081`, set `EXPO_PUBLIC_API_URL=http://localhost:4000` in `client/.env` or in the shell before starting the client.

## Android APK

Daily Meal includes custom native modules, so Expo Go is not a supported target. Use a development build for local Android testing and standalone APK/AAB builds for users.

Production and preview APKs should use:

```powershell
EXPO_PUBLIC_API_URL=https://api.dailymeal.site
```

Build from the client workspace, or use the root scripts that delegate to it:

```powershell
npm.cmd run build:apk
npm.cmd run build:aab
```

Before shipping Google Sign-In on Android, replace `client/android/app/google-services.json` with the real Firebase/Google Services file for package `com.dailymeal.app`.

For local Android debugging, set the API URL explicitly before starting/building the dev client:

```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:4000" # Android emulator
# or http://<your-computer-lan-ip>:4000 for a physical Android device
npm.cmd run dev:client
```

MongoDB local path noted during planning:

```powershell
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath C:\tmp\mongodb-daily-meal
```
