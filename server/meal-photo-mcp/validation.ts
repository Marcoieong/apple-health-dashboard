import {
  MEAL_TYPES,
  type ChatGptFileParam,
  type RecordMealInput,
  type SupportedImageType
} from './contracts';

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS_PER_MEAL = 4;

export class IngestError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unauthorized'
      | 'invalid_input'
      | 'idempotency_conflict'
      | 'unsupported_image'
      | 'download_failed'
  ) {
    super(message);
    this.name = 'IngestError';
  }
}

const hasUnsafeFileName = (name: string) =>
  name.includes('/') ||
  name.includes('\\') ||
  name.includes('\0') ||
  name === '.' ||
  name === '..' ||
  name.length > 255;

function validatePhotoParam(photo: ChatGptFileParam): URL {
  if (!photo || typeof photo !== 'object') {
    throw new IngestError('Photo metadata is invalid.', 'invalid_input');
  }

  if (typeof photo.file_id !== 'string' || !photo.file_id.trim()) {
    throw new IngestError('Photo file identifier is missing.', 'invalid_input');
  }

  if (
    photo.file_name !== undefined &&
    (typeof photo.file_name !== 'string' || hasUnsafeFileName(photo.file_name))
  ) {
    throw new IngestError('Photo filename is unsafe.', 'invalid_input');
  }

  if (photo.mime_type !== undefined && typeof photo.mime_type !== 'string') {
    throw new IngestError('Photo MIME type is invalid.', 'invalid_input');
  }

  if (typeof photo.download_url !== 'string') {
    throw new IngestError('Photo download URL is invalid.', 'invalid_input');
  }

  let url: URL;
  try {
    url = new URL(photo.download_url);
  } catch {
    throw new IngestError('Photo download URL is invalid.', 'invalid_input');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new IngestError('Photo download URL must use HTTPS.', 'invalid_input');
  }

  return url;
}

function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isBoundedStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number
): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= maximumItems &&
      value.every(
        (item) =>
          typeof item === 'string' &&
          item.trim().length > 0 &&
          item.length <= maximumLength
      ))
  );
}

export function validateRecordMealInput(input: RecordMealInput): URL[] {
  if (!input || typeof input !== 'object') {
    throw new IngestError('Meal data is invalid.', 'invalid_input');
  }

  if (
    !Array.isArray(input.photos) ||
    input.photos.length < 1 ||
    input.photos.length > MAX_PHOTOS_PER_MEAL
  ) {
    throw new IngestError('A meal must contain one to four photos.', 'invalid_input');
  }

  if (
    typeof input.client_request_id !== 'string' ||
    input.client_request_id.trim().length < 8 ||
    input.client_request_id.length > 128
  ) {
    throw new IngestError('Idempotency key is invalid.', 'invalid_input');
  }

  if (
    typeof input.local_date !== 'string' ||
    !isRealCalendarDate(input.local_date)
  ) {
    throw new IngestError('Meal date must use YYYY-MM-DD.', 'invalid_input');
  }

  if (
    typeof input.timezone !== 'string' ||
    !input.timezone ||
    input.timezone.length > 64 ||
    !isIanaTimezone(input.timezone) ||
    typeof input.meal_type !== 'string' ||
    !MEAL_TYPES.includes(input.meal_type)
  ) {
    throw new IngestError('Timezone or meal type is invalid.', 'invalid_input');
  }

  if (!isBoundedStringArray(input.food_labels, 30, 80)) {
    throw new IngestError('Food labels are invalid.', 'invalid_input');
  }

  if (!isBoundedStringArray(input.preparation_methods, 12, 60)) {
    throw new IngestError('Preparation methods are invalid.', 'invalid_input');
  }

  if (
    input.notes !== undefined &&
    (typeof input.notes !== 'string' || input.notes.length > 500)
  ) {
    throw new IngestError('Meal note is too long.', 'invalid_input');
  }

  return input.photos.map(validatePhotoParam);
}

export function detectImageType(bytes: Uint8Array): SupportedImageType {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }

  throw new IngestError(
    'Only JPEG, PNG and WebP food photos are supported.',
    'unsupported_image'
  );
}

export function verifyDownloadedPhoto(
  photo: ChatGptFileParam,
  bytes: Uint8Array,
  responseContentType?: string
): SupportedImageType {
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new IngestError('Photo size is invalid.', 'unsupported_image');
  }

  const detected = detectImageType(bytes);
  const declared = photo.mime_type?.split(';')[0]?.trim().toLowerCase();
  const responseType = responseContentType?.split(';')[0]?.trim().toLowerCase();

  if (declared?.startsWith('image/') && declared !== detected) {
    throw new IngestError('Photo type does not match its contents.', 'unsupported_image');
  }

  if (responseType?.startsWith('image/') && responseType !== detected) {
    throw new IngestError('Downloaded photo type is inconsistent.', 'unsupported_image');
  }

  return detected;
}
