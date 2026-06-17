import NetInfo from '@react-native-community/netinfo';
import * as RNFS from 'react-native-fs';
import { appConfig } from '../config/appConfig';
import { getVideoById, updateVideo } from '../db/database';
import type { VideoRecord } from '../models/video';
import {
  processQueue as processUploadQueueWithProcessor,
  resumeQueuedUploads as resumeQueueWithProcessor,
  retryFailedUploads as retryQueueFailedUploads,
  type QueueProcessResult,
} from './queueService';
import {
  shouldMarkFailedAfterAttempt,
} from './retryPolicy';

type PresignedUrlResponse = {
  presignedUrl: string;
};

type UploadHeaders = Record<string, string>;
type UploadMetadata = {
  battery_start?: number | null;
  battery_end?: number | null;
  gps?: {
    latitude?: number | null;
    longitude?: number | null;
  };
  network_type?: string;
  [key: string]: unknown;
};

function normalizeFilePath(filePath: string) {
  return filePath.startsWith('file://')
    ? filePath.replace(/^file:\/\//, '')
    : filePath;
}

function getHeaderValue(headers: UploadHeaders, headerName: string) {
  const targetHeaderName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === targetHeaderName) {
      return value;
    }
  }

  return '';
}

function extractEtag(headers: UploadHeaders) {
  const etag = getHeaderValue(headers, 'etag');
  return etag.replace(/^W\//, '').replace(/^"|"$/g, '');
}

function base64ToUint8Array(base64: string) {
  const binaryString =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');

  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

async function getNetworkTypeSafe() {
  try {
    const state = await NetInfo.fetch();
    return state.type || 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseMetadata(metadata: string): UploadMetadata {
  if (!metadata) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object') {
      return parsed as UploadMetadata;
    }
  } catch {
    // Ignore malformed metadata and preserve upload flow.
  }

  return {};
}

async function refreshUploadMetadata(video: VideoRecord) {
  const networkType = await getNetworkTypeSafe();
  const nextMetadata = JSON.stringify({
    ...parseMetadata(video.metadata),
    network_type: networkType,
  });

  if (nextMetadata !== video.metadata) {
    await updateVideo(video.video_id, {
      metadata: nextMetadata,
    });
  }

  return nextMetadata;
}

async function requestPresignedUrl(video: {
  worker_id: string;
  video_id: string;
}): Promise<string> {
  const response = await fetch(
    `${appConfig.backendBaseUrl}/generate-presigned-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        worker_id: video.worker_id,
        video_id: video.video_id,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get presigned URL: ${response.status}`);
  }

  const body = (await response.json()) as PresignedUrlResponse;

  if (!body.presignedUrl) {
    throw new Error('Backend did not return a presigned URL.');
  }

  return body.presignedUrl;
}

async function claimVideoForUpload(video: VideoRecord) {
  const latestVideo = (await getVideoById(video.video_id)) ?? video;

  if (latestVideo.upload_state === 'uploaded') {
    return latestVideo;
  }

  const shouldClaim =
    latestVideo.upload_state !== 'uploading' &&
    latestVideo.upload_state !== 'uploaded';

  if (!shouldClaim) {
    return latestVideo;
  }

  const timestamp = new Date().toISOString();
  const nextAttemptCount = latestVideo.attempt_count + 1;

  await updateVideo(latestVideo.video_id, {
    upload_state: 'uploading',
    attempt_count: nextAttemptCount,
    last_attempted_at: timestamp,
    last_error: '',
  });

  return {
    ...latestVideo,
    upload_state: 'uploading',
    attempt_count: nextAttemptCount,
    last_attempted_at: timestamp,
    last_error: '',
  };
}

async function markUploadSuccess(
  videoId: string,
  etag: string,
  lastAttemptedAt: string,
) {
  await updateVideo(videoId, {
    upload_state: 'uploaded',
    etag,
    last_attempted_at: lastAttemptedAt,
    last_error: '',
  });
}

async function markRetryState(video: VideoRecord, error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Upload failed unexpectedly.';
  const lastAttemptedAt = new Date().toISOString();

  if (shouldMarkFailedAfterAttempt(video.attempt_count)) {
    await updateVideo(video.video_id, {
      upload_state: 'failed',
      last_attempted_at: lastAttemptedAt,
      last_error: message,
    });

    return {
      ...video,
      upload_state: 'failed',
      last_attempted_at: lastAttemptedAt,
      last_error: message,
    };
  }

  await updateVideo(video.video_id, {
    upload_state: 'pending',
    last_attempted_at: lastAttemptedAt,
    last_error: message,
  });

  return {
    ...video,
    upload_state: 'pending',
    last_attempted_at: lastAttemptedAt,
    last_error: message,
  };
}

async function uploadFileToPresignedUrl(
  presignedUrl: string,
  localPath: string,
) {
  const normalizedPath = normalizeFilePath(localPath);

  if (!normalizedPath) {
    throw new Error('Local file path is missing.');
  }

  const base64FileContents = await RNFS.readFile(normalizedPath, 'base64');
  const fileBytes = base64ToUint8Array(base64FileContents);
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
    },
    body: fileBytes as unknown as never,
  });
  const responseBody = await response.text().catch(() => '');

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
  };
}

async function performUploadVideo(video: VideoRecord) {
  const claimedVideo = await claimVideoForUpload(video);

  if (claimedVideo.upload_state === 'uploaded') {
    return claimedVideo;
  }

  const metadata = await refreshUploadMetadata(claimedVideo);
  const presignedUrl = await requestPresignedUrl(claimedVideo);
  const uploadResult = await uploadFileToPresignedUrl(
    presignedUrl,
    claimedVideo.local_path,
  );

  if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
    throw new Error(
      `S3 upload failed with status ${uploadResult.statusCode}${
        uploadResult.body ? `: ${uploadResult.body}` : ''
      }`,
    );
  }

  const etag = extractEtag(uploadResult.headers);
  const lastAttemptedAt = new Date().toISOString();

  await markUploadSuccess(claimedVideo.video_id, etag, lastAttemptedAt);

  const updatedVideo = await getVideoById(claimedVideo.video_id);
  return updatedVideo ?? {
    ...claimedVideo,
    metadata,
    upload_state: 'uploaded',
    etag,
    last_attempted_at: lastAttemptedAt,
  };
}

export async function uploadVideo(video: VideoRecord) {
  try {
    return await performUploadVideo(video);
  } catch (error) {
    const latestVideo = (await getVideoById(video.video_id)) ?? video;
    await markRetryState(latestVideo, error);
    throw error;
  }
}

const queueUploadProcessor = async (video: VideoRecord) => {
  await uploadVideo(video);
};

export async function processUploadQueue(): Promise<QueueProcessResult> {
  return processUploadQueueWithProcessor(queueUploadProcessor);
}

export async function retryFailedUploadsThroughUploadService(): Promise<QueueProcessResult> {
  return retryQueueFailedUploads(queueUploadProcessor);
}

export async function resumeUploadQueueOnAppStart(): Promise<QueueProcessResult> {
  return resumeQueueWithProcessor(queueUploadProcessor);
}

export async function generatePresignedUrlForVideo(video: VideoRecord) {
  return requestPresignedUrl(video);
}
