import type { VideoRecord } from '../src/models/video';

const sampleVideo: VideoRecord = {
  video_id: 'video_001',
  worker_id: 'worker_101',
  started_at: '2026-06-16T10:00:00.000Z',
  ended_at: '2026-06-16T10:00:20.000Z',
  duration_ms: 20000,
  file_size_bytes: 123456,
  fps: 30,
  fps_tier: 'standard',
  device_model: 'Pixel 8',
  os_version: 'Android 14',
  resolution: '1920x1080',
  local_path: '/storage/emulated/0/video_001.mp4',
  etag: '',
  metadata: '{"source":"camera"}',
  upload_state: 'pending',
  attempt_count: 0,
  last_error: '',
  last_attempted_at: '',
};

function loadDatabaseModule() {
  jest.resetModules();

  const database = require('../src/db/database');
  const { open } = require('react-native-quick-sqlite');

  return {
    ...database,
    openMock: open as jest.Mock,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('initializes the database with table and indexes', async () => {
  const { initializeDatabase, openMock } = loadDatabaseModule();

  await initializeDatabase();

  expect(openMock).toHaveBeenCalledWith({ name: 'video_capture_system' });

  const connection = openMock.mock.results[0].value;
  expect(connection.executeBatchAsync).toHaveBeenCalledTimes(1);

  const [statements] = connection.executeBatchAsync.mock.calls[0];
  expect(statements).toEqual([
    [expect.stringContaining('CREATE TABLE IF NOT EXISTS videos')],
    [expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_videos_upload_state')],
    [expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_videos_worker_id')],
    [expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_videos_started_at')],
  ]);
});

test('inserts a video row', async () => {
  const { insertVideo, openMock } = loadDatabaseModule();

  await insertVideo(sampleVideo);

  const connection = openMock.mock.results[0].value;
  expect(connection.executeBatchAsync).toHaveBeenCalledTimes(1);
  expect(connection.executeAsync).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO videos'),
    [
      'video_001',
      'worker_101',
      '2026-06-16T10:00:00.000Z',
      '2026-06-16T10:00:20.000Z',
      20000,
      123456,
      30,
      'standard',
      'Pixel 8',
      'Android 14',
      '1920x1080',
      '/storage/emulated/0/video_001.mp4',
      '',
      '{"source":"camera"}',
      'pending',
      0,
      '',
      '',
    ],
  );
});

test('updates a video row', async () => {
  const { updateVideo, openMock } = loadDatabaseModule();

  await updateVideo('video_001', {
    upload_state: 'failed',
    attempt_count: 1,
    last_error: 'Network error',
  });

  const connection = openMock.mock.results[0].value;
  expect(connection.executeBatchAsync).toHaveBeenCalledTimes(1);
  expect(connection.executeAsync).toHaveBeenCalledWith(
    'UPDATE videos SET upload_state = ?, attempt_count = ?, last_error = ? WHERE video_id = ?',
    ['failed', 1, 'Network error', 'video_001'],
  );
});

test('loads pending, failed, paginated, and delete queries', async () => {
  const {
    getFailedVideos,
    getPendingVideos,
    getVideosPaginated,
    deleteVideo,
    openMock,
  } = loadDatabaseModule();

  await getPendingVideos();
  await getFailedVideos();
  await getVideosPaginated(2, 10);
  await deleteVideo('video_001');

  const connection = openMock.mock.results[0].value;
  expect(connection.executeBatchAsync).toHaveBeenCalledTimes(1);
  expect(connection.executeAsync).toHaveBeenNthCalledWith(
    1,
    'PRAGMA table_info(videos)',
  );
  expect(connection.executeAsync).toHaveBeenNthCalledWith(
    2,
    'SELECT * FROM videos WHERE upload_state = ? ORDER BY started_at DESC',
    ['pending'],
  );
  expect(connection.executeAsync).toHaveBeenNthCalledWith(
    3,
    'SELECT * FROM videos WHERE upload_state = ? ORDER BY started_at DESC',
    ['failed'],
  );
  expect(connection.executeAsync).toHaveBeenNthCalledWith(
    4,
    'SELECT * FROM videos ORDER BY started_at DESC LIMIT ? OFFSET ?',
    [10, 10],
  );
  expect(connection.executeAsync).toHaveBeenNthCalledWith(
    5,
    'SELECT COUNT(*) AS count FROM videos',
  );
  expect(connection.executeAsync).toHaveBeenNthCalledWith(
    6,
    'DELETE FROM videos WHERE video_id = ?',
    ['video_001'],
  );
});
