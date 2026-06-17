import { open, type QuickSQLiteConnection } from 'react-native-quick-sqlite';
import type {
  PaginatedVideosResult,
  VideoRecord,
  VideoUpdateInput,
} from '../models/video';

const DATABASE_NAME = 'video_capture_system';
const TABLE_NAME = 'videos';
const PAGE_SIZE_DEFAULT = 20;

let connection: QuickSQLiteConnection | null = null;

let initializationPromise: Promise<void> | null = null;

const createVideosTableSql = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    video_id TEXT PRIMARY KEY,
    worker_id TEXT,
    started_at TEXT,
    ended_at TEXT,
    duration_ms INTEGER,
    file_size_bytes INTEGER,
    fps REAL,
    fps_tier TEXT,
    device_model TEXT,
    os_version TEXT,
    resolution TEXT,
    local_path TEXT,
    etag TEXT,
    metadata TEXT,
    upload_state TEXT,
    attempt_count INTEGER,
    last_error TEXT,
    last_attempted_at TEXT
  )
`;

const createIndexesSql = [
  `CREATE INDEX IF NOT EXISTS idx_videos_upload_state ON ${TABLE_NAME} (upload_state)`,
  `CREATE INDEX IF NOT EXISTS idx_videos_worker_id ON ${TABLE_NAME} (worker_id)`,
  `CREATE INDEX IF NOT EXISTS idx_videos_started_at ON ${TABLE_NAME} (started_at)`,
];

function normalizeSqlValue(value: string | number | null | undefined) {
  return value ?? null;
}

function ensurePositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function ensureColumnExists(
  columnName: string,
  columnDefinition: string,
) {
  const result = await getConnection().executeAsync(
    `PRAGMA table_info(${TABLE_NAME})`,
  );
  const existingColumns = new Set(
    (result.rows?._array ?? []).map(
      row => String((row as Record<string, unknown>).name ?? ''),
    ),
  );

  if (!existingColumns.has(columnName)) {
    await getConnection().executeAsync(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN ${columnDefinition}`,
    );
  }
}

async function ensureDatabaseReady() {
  if (initializationPromise == null) {
    initializationPromise = getConnection()
      .executeBatchAsync([
        [createVideosTableSql],
        ...createIndexesSql.map(statement => [statement] as [string]),
      ])
      .then(async () => {
        await ensureColumnExists('etag', 'etag TEXT');
      })
      .then(() => undefined);
  }

  return initializationPromise;
}

function getConnection() {
  if (connection == null) {
    connection = open({ name: DATABASE_NAME });
  }

  return connection;
}

function buildVideoRow(video: VideoRecord) {
  return [
    video.video_id,
    video.worker_id,
    video.started_at,
    video.ended_at,
    video.duration_ms,
    video.file_size_bytes,
    video.fps,
    video.fps_tier,
    video.device_model,
    video.os_version,
    video.resolution,
    video.local_path,
    video.etag,
    video.metadata,
    video.upload_state,
    video.attempt_count,
    video.last_error,
    video.last_attempted_at,
  ];
}

function mapRowToVideo(row: Record<string, unknown>): VideoRecord {
  return {
    video_id: String(row.video_id ?? ''),
    worker_id: String(row.worker_id ?? ''),
    started_at: String(row.started_at ?? ''),
    ended_at: String(row.ended_at ?? ''),
    duration_ms: Number(row.duration_ms ?? 0),
    file_size_bytes: Number(row.file_size_bytes ?? 0),
    fps: Number(row.fps ?? 0),
    fps_tier: String(row.fps_tier ?? ''),
    device_model: String(row.device_model ?? ''),
    os_version: String(row.os_version ?? ''),
    resolution: String(row.resolution ?? ''),
    local_path: String(row.local_path ?? ''),
    etag: String(row.etag ?? ''),
    metadata: String(row.metadata ?? ''),
    upload_state: String(row.upload_state ?? ''),
    attempt_count: Number(row.attempt_count ?? 0),
    last_error: String(row.last_error ?? ''),
    last_attempted_at: String(row.last_attempted_at ?? ''),
  };
}

function rowsToVideos(rows?: { _array: unknown[] }) {
  if (!rows?._array?.length) {
    return [];
  }

  return rows._array.map(item =>
    mapRowToVideo(item as Record<string, unknown>),
  );
}

function buildUpdateStatement(videoId: string, updates: VideoUpdateInput) {
  const entries = Object.entries(updates).filter(
    ([, value]) => value !== undefined,
  );

  if (entries.length === 0) {
    throw new Error('At least one video field must be provided for update.');
  }

  const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
  const params = entries.map(([, value]) =>
    typeof value === 'number' || typeof value === 'string'
      ? normalizeSqlValue(value)
      : null,
  );

  return {
    query: `UPDATE ${TABLE_NAME} SET ${setClause} WHERE video_id = ?`,
    params: [...params, videoId],
  };
}

export async function initializeDatabase() {
  await ensureDatabaseReady();
}

export async function insertVideo(video: VideoRecord) {
  await ensureDatabaseReady();

  return getConnection().executeAsync(
    `INSERT INTO ${TABLE_NAME} (
      video_id,
      worker_id,
      started_at,
      ended_at,
      duration_ms,
      file_size_bytes,
      fps,
      fps_tier,
      device_model,
      os_version,
      resolution,
      local_path,
      etag,
      metadata,
      upload_state,
      attempt_count,
      last_error,
      last_attempted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    buildVideoRow(video),
  );
}

export async function updateVideo(videoId: string, updates: VideoUpdateInput) {
  await ensureDatabaseReady();

  const statement = buildUpdateStatement(videoId, updates);
  return getConnection().executeAsync(statement.query, statement.params);
}

export async function getPendingVideos() {
  await ensureDatabaseReady();

  const result = await getConnection().executeAsync(
    `SELECT * FROM ${TABLE_NAME} WHERE upload_state = ? ORDER BY started_at DESC`,
    ['pending'],
  );

  return rowsToVideos(result.rows);
}

export async function getFailedVideos() {
  await ensureDatabaseReady();

  const result = await getConnection().executeAsync(
    `SELECT * FROM ${TABLE_NAME} WHERE upload_state = ? ORDER BY started_at DESC`,
    ['failed'],
  );

  return rowsToVideos(result.rows);
}

export async function getUploadingVideos() {
  await ensureDatabaseReady();

  const result = await getConnection().executeAsync(
    `SELECT * FROM ${TABLE_NAME} WHERE upload_state = ? ORDER BY started_at DESC`,
    ['uploading'],
  );

  return rowsToVideos(result.rows);
}

export async function getVideoById(videoId: string) {
  await ensureDatabaseReady();

  const result = await getConnection().executeAsync(
    `SELECT * FROM ${TABLE_NAME} WHERE video_id = ? LIMIT 1`,
    [videoId],
  );

  return rowsToVideos(result.rows)[0] ?? null;
}
// This is Temprory for debug the database logs ----
export async function getAllVideos() {
  await ensureDatabaseReady();

  const result = await getConnection().executeAsync(
    `SELECT * FROM ${TABLE_NAME} ORDER BY started_at DESC`,
  );
  const videos = rowsToVideos(result.rows);

  console.log('[SQLite Debug] All videos:', videos);

  return videos;
}

export async function getVideoCount() {
  await ensureDatabaseReady();

  const result = await getConnection().executeAsync(
    `SELECT COUNT(*) AS count FROM ${TABLE_NAME}`,
  );
  const count = Number(result.rows?._array?.[0]?.count ?? 0);

  console.log('[SQLite Debug] Video count:', count);

  return count;
}

export async function getVideosPaginated(
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PaginatedVideosResult> {
  await ensureDatabaseReady();

  const safePage = ensurePositiveInteger(page, 1);
  const safePageSize = ensurePositiveInteger(pageSize, PAGE_SIZE_DEFAULT);
  const offset = (safePage - 1) * safePageSize;

  const [itemsResult, countResult] = await Promise.all([
    getConnection().executeAsync(
      `SELECT * FROM ${TABLE_NAME} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
      [safePageSize, offset],
    ),
    getConnection().executeAsync(`SELECT COUNT(*) AS count FROM ${TABLE_NAME}`),
  ]);

  const totalCount = Number(countResult.rows?._array?.[0]?.count ?? 0);
  const items = rowsToVideos(itemsResult.rows);

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    totalCount,
    hasNextPage: offset + items.length < totalCount,
  };
}

export async function deleteVideo(videoId: string) {
  await ensureDatabaseReady();

  return getConnection().executeAsync(
    `DELETE FROM ${TABLE_NAME} WHERE video_id = ?`,
    [videoId],
  );
}

export type { QuickSQLiteConnection };
