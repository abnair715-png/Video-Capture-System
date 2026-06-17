const mockSamplePendingVideo = {
  video_id: 'video_001',
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
  local_path: '/storage/emulated/0/video_001.mp4',
  etag: '',
  metadata: '{}',
  upload_state: 'pending',
  attempt_count: 0,
  last_error: '',
  last_attempted_at: '',
};

jest.mock('../src/db/database', () => ({
  getVideoById: jest.fn(),
  updateVideo: jest.fn(async () => undefined),
}));

describe('uploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads the file through a presigned URL and stores the etag', async () => {
    const database = require('../src/db/database');
    const RNFS = require('react-native-fs');
    const fetchMock = global.fetch as jest.Mock;

    let currentVideo = { ...mockSamplePendingVideo };

    database.getVideoById.mockImplementation(async () => currentVideo);
    database.updateVideo.mockImplementation(
      async (_videoId: string, updates: Record<string, unknown>) => {
        currentVideo = {
          ...currentVideo,
          ...updates,
        };
      },
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        presignedUrl: 'https://example.com/presigned-url',
      }),
    });

    RNFS.readFile.mockResolvedValueOnce('ZmFrZS12aWRlby1ieXRlcw==');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
        headers: {
          entries: function* () {
            yield ['etag', '"abc123"'];
          },
        get: (key: string) =>
          String(key).toLowerCase() === 'etag' ? '"abc123"' : null,
      },
    });

    const { uploadVideo } = require('../src/services/uploadService');

    const result = await uploadVideo(mockSamplePendingVideo);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/generate-presigned-url',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          worker_id: 'worker_101',
          video_id: 'video_001',
        }),
      }),
    );
    expect(RNFS.readFile).toHaveBeenCalledWith(
      '/storage/emulated/0/video_001.mp4',
      'base64',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/presigned-url',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
        },
      }),
    );
    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_001',
      expect.objectContaining({
        upload_state: 'uploading',
      }),
    );
    expect(database.updateVideo).toHaveBeenCalledWith(
      'video_001',
      expect.objectContaining({
        upload_state: 'uploaded',
        etag: 'abc123',
      }),
    );
    expect(result.upload_state).toBe('uploaded');
    expect(result.etag).toBe('abc123');
  });

  it('does not re-upload already uploaded videos', async () => {
    const database = require('../src/db/database');
    const RNFS = require('react-native-fs');

    database.getVideoById.mockResolvedValue({
      ...mockSamplePendingVideo,
      upload_state: 'uploaded',
      etag: 'abc123',
    });

    const { uploadVideo } = require('../src/services/uploadService');

    const result = await uploadVideo({
      ...mockSamplePendingVideo,
      upload_state: 'uploaded',
      etag: 'abc123',
    });

    expect(database.updateVideo).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(RNFS.readFile).not.toHaveBeenCalled();
    expect(result.upload_state).toBe('uploaded');
  });
});
