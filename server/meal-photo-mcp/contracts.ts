export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type MealType = (typeof MEAL_TYPES)[number];
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * Shape supplied by ChatGPT for a field declared in
 * `_meta["openai/fileParams"]`.
 */
export interface ChatGptFileParam {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
}

export interface RecordMealInput {
  photos: ChatGptFileParam[];
  client_request_id: string;
  local_date: string;
  timezone: string;
  meal_type: MealType;
  food_labels?: string[];
  preparation_methods?: string[];
  notes?: string;
}

export interface AuthContext {
  subject?: string;
  scopes: readonly string[];
}

export interface DownloadedPhoto {
  bytes: Uint8Array;
  contentType?: string;
}

export interface SanitizedPhoto {
  masterBytes: Uint8Array;
  thumbnailBytes: Uint8Array;
  masterWidth: number;
  masterHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export interface StoredMediaAsset {
  id: string;
  ownerId: string;
  contentSha256: string;
  mimeType: SupportedImageType;
  byteLength: number;
  masterWidth: number;
  masterHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  sanitizedMasterObjectKey: string;
  thumbnailObjectKey: string;
  rawOriginalPurgedAt: string;
  sanitizedAt: string;
  masterDeleteAfter: string;
}

export interface PrivateMealRecord {
  id: string;
  ownerId: string;
  idempotencyKeyHash: string;
  requestDigest: string;
  source: 'chatgpt';
  localDate: string;
  timezone: string;
  mealType: MealType;
  foodLabels: string[];
  preparationMethods: string[];
  notes?: string;
  mediaAssetIds: string[];
  createdAt: string;
}

export interface RecordMealResult {
  entry_id: string;
  local_date: string;
  meal_type: MealType;
  photo_count: number;
  reused_photo_count: number;
  status: 'recorded' | 'already_recorded';
}

export interface MealReadDto {
  id: string;
  localDate: string;
  timezone: string;
  mealType: MealType;
  foodLabels: string[];
  preparationMethods: string[];
  notes?: string;
  photos: Array<{
    thumbnailUrl: string;
    width: number;
    height: number;
    alt: string;
  }>;
  source: 'chatgpt';
}

export interface PhotoDownloader {
  download(url: URL, maximumBytes: number): Promise<DownloadedPhoto>;
}

export interface PhotoSanitizer {
  /**
   * Must correct orientation and remove EXIF, XMP, IPTC and other embedded
   * metadata from both returned images.
   */
  sanitize(
    bytes: Uint8Array,
    mimeType: SupportedImageType
  ): Promise<SanitizedPhoto>;
}

export interface MediaAssetRepository {
  /**
   * The production adapter must enforce UNIQUE(owner_id, content_sha256) and
   * serialize concurrent creators. It owns private object writes and cleanup.
   */
  getOrCreateByContentHash(
    ownerId: string,
    contentSha256: string,
    create: () => Promise<Omit<StoredMediaAsset, 'id'>>
  ): Promise<{ asset: StoredMediaAsset; created: boolean }>;
}

export interface PrivateMediaStore {
  /**
   * Atomically writes both images to a private bucket. The adapter must remove
   * either object if the pair cannot be completed.
   */
  putSanitizedPair(input: {
    masterObjectKey: string;
    thumbnailObjectKey: string;
    masterBytes: Uint8Array;
    thumbnailBytes: Uint8Array;
    mimeType: SupportedImageType;
  }): Promise<void>;
}

export interface MealRepository {
  findByIdempotencyKeyHash(
    ownerId: string,
    idempotencyKeyHash: string
  ): Promise<PrivateMealRecord | undefined>;
  /**
   * The production adapter must enforce
   * UNIQUE(owner_id, idempotency_key_hash).
   */
  createOnce(
    record: Omit<PrivateMealRecord, 'id'>,
    mediaAssets: readonly StoredMediaAsset[]
  ): Promise<{ record: PrivateMealRecord; created: boolean }>;
}

export interface IngestClock {
  now(): Date;
}

export interface RecordMealDependencies {
  downloader: PhotoDownloader;
  sanitizer: PhotoSanitizer;
  mediaAssets: MediaAssetRepository;
  mediaStore: PrivateMediaStore;
  meals: MealRepository;
  clock: IngestClock;
  /**
   * Deployment-specific allowlist for the signed attachment host.
   */
  allowDownloadUrl(url: URL): boolean;
  /**
   * Production adapters must return an HMAC, not a plain SHA digest. This
   * prevents identifiers supplied by ChatGPT from becoming recoverable lookup
   * keys in the database.
   */
  fingerprintIdempotencyKey(ownerId: string, key: string): string;
  fingerprintSourceFile(ownerId: string, fileId: string): string;
  buildPrivateObjectKeys(ownerId: string): {
    master: string;
    thumbnail: string;
  };
}
