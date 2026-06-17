import type { VideoRecord } from '../src/models/video';

const { PermissionsAndroid } = require('react-native');
const { Platform } = require('react-native');

describe('metadataService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  });

  it('derives a recording profile from the camera device snapshot', () => {
    const { resolveRecordingProfile } = require('../src/services/metadataService');

    const profile = resolveRecordingProfile({
      supportedFPSRanges: [
        { min: 24, max: 30 },
        { min: 30, max: 60 },
      ],
      getSupportedResolutions: () => [
        { width: 1280, height: 720 },
        { width: 1920, height: 1080 },
      ],
    });

    expect(profile).toEqual({
      fps: 60,
      fpsTier: 'high',
      resolution: '1920x1080',
    });

    expect(
      resolveRecordingProfile({
        supportedFPSRanges: [{ min: 15, max: 15 }],
        getSupportedResolutions: () => [{ width: 1280, height: 720 }],
      }),
    ).toMatchObject({
      fpsTier: 'low',
    });

    expect(
      resolveRecordingProfile({
        supportedFPSRanges: [{ min: 31, max: 31 }],
        getSupportedResolutions: () => [{ width: 1280, height: 720 }],
      }),
    ).toMatchObject({
      fpsTier: 'high',
    });
  });

  it('captures metadata and inserts a sqlite row', async () => {
    jest.resetModules();
    jest.doMock('../src/db/database', () => ({
      insertVideo: jest.fn(async video => video),
    }));

    const database = require('../src/db/database');
    const { captureRecordingMetadata } = require('../src/services/metadataService');

    const video: VideoRecord = await captureRecordingMetadata({
      videoId: 'video_001',
      workerId: 'worker_101',
      startedAt: '2026-06-16T10:00:00.000Z',
      endedAt: '2026-06-16T10:00:20.000Z',
      localPath: '/storage/emulated/0/video_001.mp4',
      batteryStart: 0.9,
      cameraDevice: {
        supportedFPSRanges: [{ min: 30, max: 30 }],
        getSupportedResolutions: () => [{ width: 1920, height: 1080 }],
      },
    });

    expect(database.insertVideo).toHaveBeenCalledTimes(1);
    expect(video).toMatchObject({
      video_id: 'video_001',
      worker_id: 'worker_101',
      file_size_bytes: 123456,
      fps: 30,
      fps_tier: 'standard',
      device_model: 'Pixel 8',
      os_version: '14',
      resolution: '1920x1080',
      local_path: '/storage/emulated/0/video_001.mp4',
      upload_state: 'pending',
      attempt_count: 0,
      last_error: '',
      last_attempted_at: '',
    });

    expect(JSON.parse(video.metadata)).toEqual({
      battery_start: 0.9,
      battery_end: 0.75,
      gps: {
        latitude: null,
        longitude: null,
      },
      network_type: 'unknown',
    });
  });
});
