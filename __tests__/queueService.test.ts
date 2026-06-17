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

  it('processes pending videos and recovers in-progress uploads after restart', async () => {
    const database = require('../src/db/database');
    const { processQueue } = require('../src/services/queueService');

    database.getUploadingVideos.mockResolvedValue([sampleUploadingVideo]);
    database.getPendingVideos.mockResolvedValue([samplePendingVideo]);

    const processor = jest.fn(async () => undefined);
    const result = await processQueue(processor);

    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_uploading',
      expect.objectContaining({
        upload_state: 'pending',
        last_error: 'Recovered after app restart',
      }),
    );
    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_pending',
      expect.objectContaining({
        upload_state: 'uploading',
      }),
    );
    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_pending',
      expect.objectContaining({
        upload_state: 'uploaded',
      }),
    );
    expect(processor).toHaveBeenCalledWith(
      expect.objectContaining({
        video_id: 'video_pending',
        upload_state: 'uploading',
      }),
    );
    expect(result).toEqual({
      processed: 1,
      uploaded: 1,
      failed: 0,
      recovered: 1,
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
