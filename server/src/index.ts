import fs from "node:fs";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { seedDefaultStickers } from "./services/stickers.js";

async function bootstrap() {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  await connectDatabase();
  await seedDefaultStickers();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Daily Meal API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start Daily Meal API", error);
  process.exit(1);
});
