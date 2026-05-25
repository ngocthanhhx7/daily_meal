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
npm.cmd run dev:server
npm.cmd run dev:client
```

MongoDB local path noted during planning:

```powershell
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath C:\tmp\mongodb-daily-meal
```
