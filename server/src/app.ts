import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { authRouter } from "./routes/auth.js";
import { mealsRouter } from "./routes/meals.js";
import { messagesRouter } from "./routes/messages.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { postsRouter } from "./routes/posts.js";
import { stickersRouter } from "./routes/stickers.js";
import { uploadsRouter } from "./routes/uploads.js";
import { usersRouter } from "./routes/users.js";
import { notificationsRouter } from "./routes/notifications.js";
import { paymentsRouter } from "./routes/payments.js";
import { recommendationsRouter } from "./routes/recommendations.js";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN === "*" ? true : env.CLIENT_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === "test" ? "tiny" : "dev"));
  app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "daily-meal-api" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/ingest", analyticsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/onboarding", onboardingRouter);
  app.use("/api/posts", postsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/stickers", stickersRouter);
  app.use("/api/meals", mealsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/recommendations", recommendationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
