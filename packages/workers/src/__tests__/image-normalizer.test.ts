import { describe, expect, it } from "vitest";
import {
  normalizeImage,
  isNormalizable,
  MAX_SOURCE_BYTES,
  MAX_DIMENSION,
} from "../image-generation/image-normalizer";

const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe5,
  0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

describe("image-normalizer", () => {
  it("1. PNG is re-encoded through sharp, producing canonical PNG", async () => {
    const result = await normalizeImage(MINIMAL_PNG, "image/png");
    expect(result.meta.mimeType).toBe("image/png");
    expect(result.meta.width).toBe(1);
    expect(result.meta.height).toBe(1);
    expect(result.meta.byteSize).toBeGreaterThan(0);
    expect(result.meta.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.originalMimeType).toBe("image/png");
    expect(result.buffer).not.toBe(MINIMAL_PNG);
  });

  it("2. accepts PNG without explicit MIME type (defaults to image/png)", async () => {
    const result = await normalizeImage(MINIMAL_PNG);
    expect(result.meta.mimeType).toBe("image/png");
  });

  it("3. rejects empty buffer", async () => {
    try {
      await normalizeImage(Buffer.alloc(0), "image/png");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("EMPTY_BUFFER");
    }
  });

  it("4. rejects oversized source", async () => {
    try {
      const oversized = Buffer.alloc(MAX_SOURCE_BYTES + 1);
      await normalizeImage(oversized, "image/png");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("SOURCE_TOO_LARGE");
    }
  });

  it("5. rejects unsupported MIME type", async () => {
    try {
      await normalizeImage(MINIMAL_PNG, "image/gif");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("UNSUPPORTED_MIME_TYPE");
    }
  });

  it("6. isNormalizable detects supported types", () => {
    expect(isNormalizable("image/png")).toBe(true);
    expect(isNormalizable("image/jpeg")).toBe(true);
    expect(isNormalizable("image/webp")).toBe(true);
    expect(isNormalizable("image/gif")).toBe(false);
    expect(isNormalizable("")).toBe(false);
  });

  it("7. converts JPEG input to canonical PNG", async () => {
    const width = 2;
    const height = 2;

    const sharp = await import("sharp");
    const jpegBuffer = await sharp
      .default({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
      .jpeg()
      .toBuffer();

    const result = await normalizeImage(jpegBuffer, "image/jpeg");

    expect(result.meta.mimeType).toBe("image/png");
    expect(result.originalMimeType).toBe("image/jpeg");
    expect(result.meta.width).toBe(width);
    expect(result.meta.height).toBe(height);
  });

  it("8. converts WebP input to canonical PNG", async () => {
    const width = 3;
    const height = 3;

    const sharp = await import("sharp");
    const webpBuffer = await sharp
      .default({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
      .webp()
      .toBuffer();

    const result = await normalizeImage(webpBuffer, "image/webp");

    expect(result.meta.mimeType).toBe("image/png");
    expect(result.originalMimeType).toBe("image/webp");
    expect(result.meta.width).toBe(width);
    expect(result.meta.height).toBe(height);
  });

  it("9. rejects image exceeding max dimension", async () => {
    const hugeSize = MAX_DIMENSION + 1;

    const sharp = await import("sharp");
    const pngBuffer = await sharp
      .default({
        create: {
          width: hugeSize,
          height: 1,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
      .png()
      .toBuffer();

    try {
      await normalizeImage(pngBuffer, "image/png");
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("DIMENSION_TOO_LARGE");
    }
  });

  it("10. passes through parseImageMeta validator producing valid metadata", async () => {
    const result = await normalizeImage(MINIMAL_PNG, "image/png");
    expect(result.meta.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.meta.byteSize).toBeGreaterThan(0);
    expect(result.meta.width).toBeGreaterThan(0);
    expect(result.meta.height).toBeGreaterThan(0);
  });

  it("11. rejects garbage binary data", async () => {
    const garbage = Buffer.from([
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    ]);
    await expect(normalizeImage(garbage, "image/png")).rejects.toThrow();
  });

  it("12. PNG/JPEG/WebP all produce the same canonical PNG format", async () => {
    const sharp = await import("sharp");

    const pngBuf = await sharp
      .default({
        create: {
          width: 4,
          height: 4,
          channels: 3,
          background: { r: 128, g: 64, b: 192 },
        },
      })
      .png()
      .toBuffer();
    const jpegBuf = await sharp
      .default({
        create: {
          width: 4,
          height: 4,
          channels: 3,
          background: { r: 128, g: 64, b: 192 },
        },
      })
      .jpeg()
      .toBuffer();
    const webpBuf = await sharp
      .default({
        create: {
          width: 4,
          height: 4,
          channels: 3,
          background: { r: 128, g: 64, b: 192 },
        },
      })
      .webp()
      .toBuffer();

    const pngResult = await normalizeImage(pngBuf, "image/png");
    const jpegResult = await normalizeImage(jpegBuf, "image/jpeg");
    const webpResult = await normalizeImage(webpBuf, "image/webp");

    expect(pngResult.meta.mimeType).toBe("image/png");
    expect(jpegResult.meta.mimeType).toBe("image/png");
    expect(webpResult.meta.mimeType).toBe("image/png");
    expect(pngResult.meta.width).toBe(4);
    expect(jpegResult.meta.width).toBe(4);
    expect(webpResult.meta.width).toBe(4);

    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(pngResult.buffer.subarray(0, 8)).toEqual(signature);
    expect(jpegResult.buffer.subarray(0, 8)).toEqual(signature);
    expect(webpResult.buffer.subarray(0, 8)).toEqual(signature);
  });
});
