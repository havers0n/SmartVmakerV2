import { createHash } from "node:crypto";

export const ALLOWED_MIME_TYPES = ["image/png"] as const;
export const MAX_DIMENSION = 16384;

export interface ImageMeta {
  mimeType: "image/png";
  extension: "png";
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function parseImageMeta(buffer: Buffer): ImageMeta {
  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError("EMPTY_BUFFER", "Image buffer is empty");
  }

  const byteSize = buffer.length;

  if (byteSize < 8) {
    throw new ImageValidationError("TOO_SMALL", "Image buffer is too small");
  }

  if (!PNG_SIGNATURE.equals(buffer.subarray(0, 8))) {
    throw new ImageValidationError(
      "INVALID_SIGNATURE",
      "Not a valid PNG image",
    );
  }

  if (byteSize < 33) {
    throw new ImageValidationError(
      "NO_IHDR",
      "PNG file too small to contain IHDR",
    );
  }

  const ihdrLength = buffer.readUInt32BE(8);
  if (buffer.readUInt32BE(12) !== 0x49484452) {
    throw new ImageValidationError("NO_IHDR", "Missing IHDR chunk");
  }
  if (ihdrLength < 13) {
    throw new ImageValidationError("BAD_IHDR", "IHDR chunk too small");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  if (width <= 0 || height <= 0) {
    throw new ImageValidationError(
      "ZERO_DIMENSION",
      "Image dimensions must be positive",
    );
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ImageValidationError(
      "DIMENSION_TOO_LARGE",
      `Image dimensions exceed maximum ${MAX_DIMENSION}`,
    );
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");

  return {
    mimeType: "image/png",
    extension: "png",
    width,
    height,
    byteSize,
    checksum,
  };
}

export class ImageValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImageValidationError";
  }
}
