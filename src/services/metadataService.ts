import { PermissionsAndroid, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import * as RNFS from 'react-native-fs';
import Geolocation from 'react-native-geolocation-service';
import { insertVideo } from '../db/database';
import type { VideoRecord } from '../models/video';

type CameraDeviceSnapshot = {
  manufacturer?: string;
  modelID?: string;
  localizedName?: string;
  supportedFPSRanges?: Array<{
    min: number;
    max: number;
  }>;
  getSupportedResolutions?: (
    outputStreamType: string,
  ) => Array<{
    width: number;
    height: number;
  }>;
};

export type RecordingMetadataInput = {
  videoId: string;
  workerId: string;
  startedAt: string;
  endedAt?: string;
  localPath: string;
  cameraDevice?: unknown | null;
  batteryStart?: number | null;
};

type BonusMetadata = {
  battery_start: number | null;
  battery_end: number | null;
  gps: {
    latitude: number | null;
    longitude: number | null;
  };
  network_type: string;
};

export type RecordingProfile = {
  fps: number;
  fpsTier: string;
  resolution: string;
};

function normalizeFilePath(filePath: string) {
  return filePath.startsWith('file://')
    ? filePath.replace(/^file:\/\//, '')
    : filePath;
}

function formatResolution(width: number, height: number) {
  return `${width}x${height}`;
}

function selectLargestResolution(
  resolutions: Array<{
    width: number;
    height: number;
  }>,
) {
  return resolutions.reduce(
    (largest, current) =>
      current.width * current.height > largest.width * largest.height
        ? current
        : largest,
    resolutions[0],
  );
}

function resolveFpsTier(fps: number) {
  if (fps >= 90) {
    return 'ultra';
  }

  if (fps >= 60) {
    return 'high';
  }

  if (fps >= 30) {
    return 'standard';
  }

  return 'low';
}

export function resolveRecordingProfile(
  cameraDevice?: CameraDeviceSnapshot | null,
): RecordingProfile {
  const supportedRanges = cameraDevice?.supportedFPSRanges ?? [];
  const fps = supportedRanges.length
    ? Math.max(...supportedRanges.map(range => range.max))
    : 30;
  const supportedResolutions =
    cameraDevice?.getSupportedResolutions?.('video') ?? [];
  const largestResolution =
    supportedResolutions.length > 0
      ? selectLargestResolution(supportedResolutions)
      : null;
  const resolution = largestResolution
    ? formatResolution(largestResolution.width, largestResolution.height)
    : 'unknown';

  return {
    fps,
    fpsTier: resolveFpsTier(fps),
    resolution,
  };
}

async function getBatteryLevelSafe() {
  try {
    return await DeviceInfo.getBatteryLevel();
  } catch {
    return null;
  }
}

export async function captureBatteryLevelSnapshot() {
  return getBatteryLevelSafe();
}

async function getNetworkTypeSafe() {
  try {
    const state = await NetInfo.fetch();
    return state.type;
  } catch {
    return 'unknown';
  }
}

async function requestLocationPermission() {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (typeof PermissionsAndroid.request !== 'function') {
    return false;
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const result = await PermissionsAndroid.request(permission);

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function getGpsCoordinatesSafe() {
  try {
    const hasPermission = await requestLocationPermission();

    if (!hasPermission) {
      return {
        latitude: null,
        longitude: null,
      };
    }

    const position = await new Promise<{
      latitude: number | null;
      longitude: number | null;
    }>(resolve => {
      Geolocation.getCurrentPosition(
        location => {
          resolve({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        },
        () => {
          resolve({
            latitude: null,
            longitude: null,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    });

    return position;
  } catch {
    return {
      latitude: null,
      longitude: null,
    };
  }
}

async function getFileSizeBytes(localPath: string) {
  const stat = await RNFS.stat(normalizeFilePath(localPath));
  return stat.size;
}

function buildBonusMetadata(
  input: RecordingMetadataInput,
  batteryEnd: number | null,
  gps: {
    latitude: number | null;
    longitude: number | null;
  },
  networkType: string,
): BonusMetadata {
  return {
    battery_start: input.batteryStart ?? null,
    battery_end: batteryEnd,
    gps,
    network_type: networkType,
  };
}

export async function captureRecordingMetadata(
  input: RecordingMetadataInput,
): Promise<VideoRecord> {
  const endedAt = input.endedAt ?? new Date().toISOString();
  const profile = resolveRecordingProfile(
    input.cameraDevice as CameraDeviceSnapshot | null | undefined,
  );
  const [fileSizeBytes, batteryEnd, networkType, gps, deviceModel, osVersion] =
    await Promise.all([
      getFileSizeBytes(input.localPath),
      getBatteryLevelSafe(),
      getNetworkTypeSafe(),
      getGpsCoordinatesSafe(),
      Promise.resolve(DeviceInfo.getModel()),
      Promise.resolve(DeviceInfo.getSystemVersion()),
    ]);

  const bonusMetadata = buildBonusMetadata(input, batteryEnd, gps, networkType);
  const metadata = JSON.stringify(bonusMetadata);

  const video: VideoRecord = {
    video_id: input.videoId,
    worker_id: input.workerId,
    started_at: input.startedAt,
    ended_at: endedAt,
    duration_ms: Math.max(0, Date.parse(endedAt) - Date.parse(input.startedAt)),
    file_size_bytes: fileSizeBytes,
    fps: profile.fps,
    fps_tier: profile.fpsTier,
    device_model: deviceModel,
    os_version: osVersion,
    resolution: profile.resolution,
    local_path: input.localPath,
    etag: '',
    metadata,
    upload_state: 'pending',
    attempt_count: 0,
    last_error: '',
    last_attempted_at: '',
  };

  await insertVideo(video);

  return video;
}
