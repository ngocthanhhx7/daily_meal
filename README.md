# Daily Meal

Daily Meal is a TypeScript monorepo with an Expo React Native client and a Node.js Express API.

## Structure

- `client/` - Expo React Native app.
- `server/` - Express, MongoDB, Gemini, uploads API.
- `docs/IMPLEMENTATION.md` - setup, architecture, API map, and asset notes.

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

MongoDB local path noted during planning:

```powershell
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath C:\tmp\mongodb-daily-meal
```
