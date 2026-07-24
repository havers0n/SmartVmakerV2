import type { StorageAdapter } from "@scrimspec/hwar-core";
import { uploadBuffer, deleteObject } from "@aec/storage-client";

const DURABLE_IMAGE_PREFIX = "images/runs/";
const UPLOAD_TIMEOUT_MS = 30_000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function validateKey(key: string): void {
  if (!key.startsWith(DURABLE_IMAGE_PREFIX)) {
    throw new Error(
      `Storage key must start with "${DURABLE_IMAGE_PREFIX}"; got "${key}"`,
    );
  }

  const parts = key.split("/");
  if (parts.length < 5) {
    throw new Error(
      `Storage key must match images/runs/{runId}/attempts/{attemptId}/output.png`,
    );
  }

  if (!key.endsWith("/output.png")) {
    throw new Error("Storage key must end with /output.png");
  }
}

export function createR2StorageAdapter(): StorageAdapter {
  return { put, delete: del };
}

async function put(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ key: string }> {
  validateKey(key);

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Upload buffer exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`,
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    await uploadBuffer(key, buffer, mimeType);
  } finally {
    clearTimeout(timeoutId);
  }

  return { key };
}

async function del(key: string): Promise<void> {
  try {
    await deleteObject(key);
  } catch {
    // Best-effort delete — swallow errors
  }
}
