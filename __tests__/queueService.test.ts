const samplePendingVideo = {
  video_id: 'video_pending',
  worker_id: 'worker_101',
  started_at: '2026-06-16T10:00:00.000Z',
  ended_at: '2026-06-16T10:00:20.000Z',
  duration_ms: 20000,
  file_size_bytes: 123456,
  fps: 30,
  fps_tier: 'standard',
  device_model: 'Pixel 8',
  os_version: '14',
  resolution: '1920x1080',
  local_path: '/storage/emulated/0/video_pending.mp4',
  etag: '',
  metadata: '{}',
  upload_state: 'pending',
  attempt_count: 0,
  last_error: '',
  last_attempted_at: '',
};

const sampleFailedVideo = {
  ...samplePendingVideo,
  video_id: 'video_failed',
  upload_state: 'failed',
};

const sampleUploadedVideo = {
  ...samplePendingVideo,
  video_id: 'video_uploaded',
  upload_state: 'uploaded',
};

const sampleUploadingVideo = {
  ...samplePendingVideo,
  video_id: 'video_uploading',
  upload_state: 'uploading',
};

jest.mock('../src/db/database', () => ({
  getVideoById: jest.fn(),
  getPendingVideos: jest.fn(),
  getFailedVideos: jest.fn(),
  getUploadingVideos: jest.fn(),
  updateVideo: jest.fn(async () => undefined),
}));

describe('queueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not move uploaded videos back to pending', async () => {
    const database = require('../src/db/database');
    const { enqueueVideo } = require('../src/services/queueService');

    database.getVideoById.mockResolvedValue(sampleUploadedVideo);

    const result = await enqueueVideo('video_uploaded');

    expect(result.upload_state).toBe('uploaded');
    expect(database.updateVideo).not.toHaveBeenCalled();
  });

  it('requeues failed videos as pending', async () => {
    const database = require('../src/db/database');
    const { enqueueVideo } = require('../src/services/queueService');

    database.getVideoById.mockResolvedValue(sampleFailedVideo);

    const result = await enqueueVideo('video_failed');

    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_failed',
      expect.objectContaining({
        upload_state: 'pending',
        last_error: '',
        last_attempted_at: expect.any(String),
      }),
    );
    expect(result.upload_state).toBe('pending');
  });

  it('recovers in-progress uploads on app start and processes pending videos', async () => {
    const database = require('../src/db/database');
    const { resumeQueuedUploads } = require('../src/services/queueService');

    database.getUploadingVideos.mockResolvedValue([sampleUploadingVideo]);
    database.getPendingVideos.mockResolvedValue([samplePendingVideo]);
    database.getFailedVideos.mockResolvedValue([]);

    const processor = jest.fn(async () => undefined);
    const result = await resumeQueuedUploads(processor);

    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_uploading',
      expect.objectContaining({
        upload_state: 'pending',
        last_error: 'Recovered after app restart',
      }),
    );
    expect(processor).toHaveBeenCalledWith(samplePendingVideo);
    expect(result).toEqual({
      processed: 1,
      uploaded: 1,
      failed: 0,
      recovered: 1,
    });
  });

  it('skips pending videos until their retry delay has elapsed', async () => {
    const database = require('../src/db/database');
    const { processQueue } = require('../src/services/queueService');

    database.getUploadingVideos.mockResolvedValue([]);
    database.getPendingVideos.mockResolvedValue([
      {
        ...samplePendingVideo,
        attempt_count: 1,
        last_attempted_at: new Date(Date.now() - 1000).toISOString(),
      },
    ]);

    const processor = jest.fn(async () => undefined);
    const result = await processQueue(processor);

    expect(processor).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 0,
      uploaded: 0,
      failed: 0,
      recovered: 0,
    });
  });

  it('does not recover uploading videos during a normal queue run', async () => {
    const database = require('../src/db/database');
    const { processQueue } = require('../src/services/queueService');

    database.getUploadingVideos.mockResolvedValue([sampleUploadingVideo]);
    database.getPendingVideos.mockResolvedValue([samplePendingVideo]);

    const processor = jest.fn(async () => undefined);
    const result = await processQueue(processor);

    expect(database.updateVideo).not.toHaveBeenCalledWith(
      'video_uploading',
      expect.objectContaining({
        upload_state: 'pending',
        last_error: 'Recovered after app restart',
      }),
    );
    expect(processor).toHaveBeenCalledWith(samplePendingVideo);
    expect(result).toEqual({
      processed: 1,
      uploaded: 1,
      failed: 0,
      recovered: 0,
    });
  });

  it('retries failed uploads through the same queue processor', async () => {
    const database = require('../src/db/database');
    const { retryFailedUploads } = require('../src/services/queueService');

    database.getFailedVideos.mockResolvedValue([sampleFailedVideo]);
    database.getUploadingVideos.mockResolvedValue([]);
    database.getPendingVideos.mockResolvedValue([sampleFailedVideo]);

    const processor = jest.fn(async () => undefined);

    const result = await retryFailedUploads(processor);

    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_failed',
      expect.objectContaining({
        upload_state: 'pending',
      }),
    );
    expect(result.uploaded).toBe(1);
    expect(processor).toHaveBeenCalledTimes(1);
  });
});
