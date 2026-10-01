export const MAX_PHOTO_BYTES = 10_485_760;
export const MAX_PHOTO_DIMENSION = 12_000;
export const MAX_PHOTO_PIXELS = 24_000_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
]);

export class PhotoImageError extends Error {
  constructor(code, message, rejectionCode = code) {
    super(message);
    this.name = "PhotoImageError";
    this.code = code;
    this.rejectionCode = rejectionCode;
  }
}

function imageError(code, message, rejectionCode = code) {
  return new PhotoImageError(code, message, rejectionCode);
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

function readUint16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0);
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function hasPngSignature(bytes) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export function sniffImageMimeType(bytes) {
  if (
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && hasPngSignature(bytes)) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brands = [ascii(bytes, 8, 4)];
    for (
      let offset = 16;
      offset + 4 <= Math.min(bytes.length, 40);
      offset += 4
    ) {
      brands.push(ascii(bytes, offset, 4));
    }
    if (brands.some((brand) => HEIC_BRANDS.has(brand))) {
      return "image/heic";
    }
  }
  return null;
}

function jpegHasLengthlessMarker(marker) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

function isSofMarker(marker) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (jpegHasLengthlessMarker(marker)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = readUint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (isSofMarker(marker)) {
      if (segmentLength < 7) break;
      return {
        height: readUint16(bytes, offset + 3),
        width: readUint16(bytes, offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw imageError(
    "invalid_image_content",
    "JPEG dimensions could not be read.",
    "undecodable_image",
  );
}

function pngDimensions(bytes) {
  if (
    bytes.length < 24 || !hasPngSignature(bytes) ||
    ascii(bytes, 12, 4) !== "IHDR"
  ) {
    throw imageError(
      "invalid_image_content",
      "PNG header is invalid.",
      "undecodable_image",
    );
  }
  return {
    width: readUint32(bytes, 16),
    height: readUint32(bytes, 20),
  };
}

function assertDeclaredMimeType(declaredMimeType, detectedMimeType) {
  if (!declaredMimeType) return;
  const normalized = declaredMimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    throw imageError(
      "unsupported_media_type",
      "Photo MIME type is not supported.",
      "unsupported_media_type",
    );
  }
  if (normalized !== detectedMimeType) {
    throw imageError(
      "unsupported_media_type",
      "Declared photo MIME type does not match its content.",
      "mime_mismatch",
    );
  }
}

function assertDimensions({ width, height }) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_PHOTO_DIMENSION ||
    height > MAX_PHOTO_DIMENSION ||
    width * height > MAX_PHOTO_PIXELS
  ) {
    throw imageError(
      "image_too_large",
      "Photo dimensions exceed the allowed limits.",
      "image_too_large",
    );
  }
}

async function decodeAndEncodeImage(bytes, detectedMimeType) {
  const { default: Jimp } = await import("jimp-compact");
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const image = await Jimp.read(input);
  const dimensions = {
    width: image.bitmap.width,
    height: image.bitmap.height,
  };
  assertDimensions(dimensions);
  const outputMime = detectedMimeType === "image/png"
    ? Jimp.MIME_PNG
    : Jimp.MIME_JPEG;
  const encoded = await image.getBufferAsync(outputMime);
  return {
    bytes: new Uint8Array(encoded),
    ...dimensions,
  };
}

export async function sanitizePhotoBytes({
  bytes,
  declaredMimeType = "",
} = {}) {
  if (!(bytes instanceof Uint8Array)) {
    throw imageError("invalid_image_content", "Photo bytes are required.");
  }
  if (bytes.length < 1 || bytes.length > MAX_PHOTO_BYTES) {
    throw imageError(
      "photo_too_large",
      "Photo byte size exceeds the allowed limit.",
      "photo_too_large",
    );
  }

  const detectedMimeType = sniffImageMimeType(bytes);
  if (!detectedMimeType) {
    throw imageError(
      "invalid_image_content",
      "Photo content is not a supported image.",
      "undecodable_image",
    );
  }
  if (!ALLOWED_MIME_TYPES.has(detectedMimeType)) {
    throw imageError(
      "unsupported_media_type",
      "Photo MIME type is not supported.",
      "unsupported_media_type",
    );
  }
  assertDeclaredMimeType(declaredMimeType, detectedMimeType);

  const dimensions = detectedMimeType === "image/jpeg"
    ? jpegDimensions(bytes)
    : pngDimensions(bytes);
  assertDimensions(dimensions);

  try {
    const sanitized = await decodeAndEncodeImage(bytes, detectedMimeType);
    if (
      sanitized.bytes.length < 1 || sanitized.bytes.length > MAX_PHOTO_BYTES
    ) {
      throw imageError(
        "photo_too_large",
        "Sanitized photo byte size exceeds the allowed limit.",
        "photo_too_large",
      );
    }
    return {
      bytes: sanitized.bytes,
      detectedMimeType,
      width: sanitized.width,
      height: sanitized.height,
    };
  } catch (error) {
    if (error instanceof PhotoImageError) throw error;
    throw imageError(
      "invalid_image_content",
      "Photo could not be decoded.",
      "undecodable_image",
    );
  }
}
