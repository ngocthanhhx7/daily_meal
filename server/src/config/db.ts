import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase(uri = env.MONGO_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
