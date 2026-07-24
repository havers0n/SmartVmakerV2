import sharp from "sharp";
import { parseImageMeta, ImageValidationError } from "@scrimspec/hwar-core";

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_DIMENSION = 16384;
export const MAX_PIXEL_COUNT = 256 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

export const NORMALIZABLE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type NormalizableMimeType = (typeof NORMALIZABLE_MIME_TYPES)[number];

export interface NormalizedImage {
  buffer: Buffer;
  meta: ReturnType<typeof parseImageMeta>;
  originalMimeType: string;
}

export function isNormalizable(
  mimeType: string,
): mimeType is NormalizableMimeType {
  return (NORMALIZABLE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export async function normalizeImage(
  buffer: Buffer,
  sourceMimeType?: string,
): Promise<NormalizedImage> {
  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError("EMPTY_BUFFER", "Image buffer is empty");
  }

  if (buffer.length > MAX_SOURCE_BYTES) {
    throw new ImageValidationError(
      "SOURCE_TOO_LARGE",
      `Source image exceeds maximum size of ${MAX_SOURCE_BYTES} bytes`,
    );
  }

  const mime = sourceMimeType ?? "image/png";

  if (!isNormalizable(mime)) {
    throw new ImageValidationError(
      "UNSUPPORTED_MIME_TYPE",
      `Unsupported image MIME type: ${mime}`,
    );
  }

  const metadata = await sharp(buffer)
    .metadata()
    .catch(() => {
      throw new ImageValidationError("DECODE_FAILED", "Failed to decode image");
    });

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new ImageValidationError(
      "ZERO_DIMENSION",
      "Image dimensions must be positive",
    );
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ImageValidationError(
      "DIMENSION_TOO_LARGE",
      `Image dimensions ${width}x${height} exceed maximum ${MAX_DIMENSION}`,
    );
  }

  const pixelCount = width * height;
  if (pixelCount > MAX_PIXEL_COUNT) {
    throw new ImageValidationError(
      "PIXEL_COUNT_EXCEEDED",
      `Image pixel count ${pixelCount} exceeds maximum ${MAX_PIXEL_COUNT}`,
    );
  }

  const normalizedBuffer = await sharp(buffer).png().withMetadata().toBuffer();

  if (normalizedBuffer.length > MAX_OUTPUT_BYTES) {
    throw new ImageValidationError(
      "OUTPUT_TOO_LARGE",
      `Normalized PNG exceeds maximum size of ${MAX_OUTPUT_BYTES} bytes`,
    );
  }

  const meta = parseImageMeta(normalizedBuffer);

  return { buffer: normalizedBuffer, meta, originalMimeType: mime };
}
