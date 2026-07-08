import mongoose from "mongoose";
import { env } from "./env.js";
import { User } from "../models/User.js";

const uniqueStringIndexes = [
  { field: "email", name: "email_1" },
  { field: "phone", name: "phone_1" },
  { field: "facebookId", name: "facebookId_1" },
  { field: "authProviders.google.sub", name: "authProviders.google.sub_1" }
] as const;

function isMatchingPartialUniqueStringIndex(index: any, field: string) {
  return (
    index.unique === true &&
    JSON.stringify(index.key) === JSON.stringify({ [field]: 1 }) &&
    JSON.stringify(index.partialFilterExpression) === JSON.stringify({ [field]: { $type: "string" } })
  );
}

function isNamespaceExistsError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "codeName" in error) &&
    ((error as { code?: unknown }).code === 48 || (error as { codeName?: unknown }).codeName === "NamespaceExists")
  );
}

export async function repairUserUniqueIndexes() {
  await User.createCollection().catch((error) => {
    if (!isNamespaceExistsError(error)) {
      throw error;
    }
  });

  for (const { field } of uniqueStringIndexes) {
    await User.collection.updateMany({ [field]: null }, { $unset: { [field]: "" } });
  }

  const indexes = await User.collection.indexes();

  for (const { field, name } of uniqueStringIndexes) {
    const existing = indexes.find((index) => index.name === name);

    if (existing && !isMatchingPartialUniqueStringIndex(existing, field)) {
      await User.collection.dropIndex(name);
    }

    if (!existing || !isMatchingPartialUniqueStringIndex(existing, field)) {
      await User.collection.createIndex(
        { [field]: 1 },
        {
          unique: true,
          partialFilterExpression: { [field]: { $type: "string" } },
          name
        }
      );
    }
  }
}

export async function connectDatabase(uri = env.MONGO_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await repairUserUniqueIndexes();
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
