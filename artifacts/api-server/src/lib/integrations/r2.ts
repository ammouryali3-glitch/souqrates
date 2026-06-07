import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../logger";

let s3: S3Client | null = null;
let cfg: { bucketName: string; publicUrl: string } | null = null;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export function initR2(config: R2Config): void {
  try {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId.trim()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId.trim(),
        secretAccessKey: config.secretAccessKey.trim(),
      },
    });
    cfg = { bucketName: config.bucketName.trim(), publicUrl: config.publicUrl.trim().replace(/\/$/, "") };
    logger.info("Cloudflare R2 client initialized");
  } catch (err) {
    s3 = null;
    cfg = null;
    logger.error({ err }, "Failed to initialize R2 client");
  }
}

export function destroyR2(): void {
  s3 = null;
  cfg = null;
}

export function getR2Client(): S3Client | null {
  return s3;
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  if (!s3 || !cfg) throw new Error("R2 not configured");
  await s3.send(new PutObjectCommand({
    Bucket: cfg.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${cfg.publicUrl}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  if (!s3 || !cfg) return;
  await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucketName, Key: key }));
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  if (!s3 || !cfg) throw new Error("R2 not configured");
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: cfg.bucketName, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

export async function testR2Connection(): Promise<{ ok: boolean; error?: string }> {
  if (!s3 || !cfg) return { ok: false, error: "Client not initialized" };
  try {
    await s3.send(new HeadBucketCommand({ Bucket: cfg.bucketName }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isR2Ready(): boolean {
  return s3 !== null && cfg !== null;
}
