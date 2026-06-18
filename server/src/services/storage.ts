import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type ObjectCannedACL
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

export type StorageProvider = "local" | "s3";

export type StoredUpload = {
  storageProvider: StorageProvider;
  url: string;
  localPath?: string;
  s3Bucket?: string;
  s3Key?: string;
  etag?: string;
};

type UploadFile = Express.Multer.File;
type UploadRecord = {
  storageProvider?: string;
  localPath?: string | null;
  s3Bucket?: string | null;
  s3Key?: string | null;
};

let s3Client: S3Client | undefined;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              sessionToken: env.AWS_SESSION_TOKEN
            }
          : undefined
    });
  }

  return s3Client;
}

function assertS3Configured() {
  if (!env.S3_BUCKET) {
    throw new HttpError(500, "S3 bucket is not configured");
  }
}

function extensionFor(file: UploadFile) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext) {
    return ext;
  }

  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  if (file.mimetype === "image/gif") return ".gif";
  if (file.mimetype === "video/mp4") return ".mp4";
  if (file.mimetype === "video/quicktime") return ".mov";
  if (file.mimetype === "video/x-m4v") return ".m4v";
  return ".jpg";
}

function safeCategory(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "other";
}

function objectKeyFor(file: UploadFile, category: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${safeCategory(category)}/${year}/${month}/${Date.now()}-${randomUUID()}${extensionFor(file)}`;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function publicUrlForS3(bucket: string, key: string) {
  const encodedKey = encodeKey(key);

  if (env.S3_PUBLIC_BASE_URL) {
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${encodedKey}`;
  }

  return `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${encodedKey}`;
}

async function storeLocal(file: UploadFile, category: string): Promise<StoredUpload> {
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  const filename = path.basename(objectKeyFor(file, category)).replace(/[^a-zA-Z0-9._-]/g, "-");
  const localPath = path.join(env.UPLOAD_DIR, filename);
  await fs.writeFile(localPath, file.buffer);

  return {
    storageProvider: "local",
    url: `/uploads/${filename}`,
    localPath
  };
}

async function storeS3(file: UploadFile, category: string): Promise<StoredUpload> {
  assertS3Configured();
  const bucket = env.S3_BUCKET!;
  const key = objectKeyFor(file, category);
  const response = await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: env.S3_OBJECT_ACL as ObjectCannedACL | undefined
    })
  );

  return {
    storageProvider: "s3",
    url: publicUrlForS3(bucket, key),
    s3Bucket: bucket,
    s3Key: key,
    etag: response.ETag
  };
}

export async function storeUploadedFile(file: UploadFile, category: string): Promise<StoredUpload> {
  if (env.STORAGE_DRIVER === "s3") {
    return storeS3(file, category);
  }

  return storeLocal(file, category);
}

export const storeUploadedImage = storeUploadedFile;

async function bodyToBuffer(body: GetObjectCommandOutput["Body"]) {
  if (!body) {
    throw new HttpError(404, "Stored upload body is empty");
  }

  if ("transformToByteArray" in body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function readStoredUpload(upload: UploadRecord) {
  if (upload.storageProvider === "s3") {
    if (!upload.s3Bucket || !upload.s3Key) {
      throw new HttpError(500, "S3 upload metadata is incomplete");
    }

    const object = await getS3Client().send(
      new GetObjectCommand({
        Bucket: upload.s3Bucket,
        Key: upload.s3Key
      })
    );
    return bodyToBuffer(object.Body);
  }

  if (!upload.localPath) {
    throw new HttpError(500, "Local upload path is missing");
  }

  return fs.readFile(upload.localPath);
}
