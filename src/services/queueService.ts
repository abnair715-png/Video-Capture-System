import {
  getFailedVideos,
  getPendingVideos,
  getUploadingVideos,
  getVideoById,
  updateVideo,
} from '../db/database';
import type { VideoRecord } from '../models/video';

export type QueueProcessor = (video: VideoRecord) => Promise<void>;

export type QueueProcessResult = {
  processed: number;
  uploaded: number;
  failed: number;
  recovered: number;
};

let activeQueueRun: Promise<QueueProcessResult> | null = null;

function createTimestamp() {
  return new Date().toISOString();
}

async function markVideoState(
  videoId: string,
  uploadState: VideoRecord['upload_state'],
  extraUpdates: Partial<VideoRecord> = {},
) {
  await updateVideo(videoId, {
    upload_state: uploadState,
    ...extraUpdates,
  });
}

async function claimForUpload(video: VideoRecord) {
  const nextAttemptCount = video.attempt_count + 1;
  const timestamp = createTimestamp();

  await markVideoState(video.video_id, 'uploading', {
    attempt_count: nextAttemptCount,
    last_attempted_at: timestamp,
    last_error: '',
  });

  return {
    ...video,
    upload_state: 'uploading',
    attempt_count: nextAttemptCount,
    last_attempted_at: timestamp,
    last_error: '',
  };
}

async function finishUpload(video: VideoRecord) {
  await markVideoState(video.video_id, 'uploaded', {
    last_attempted_at: createTimestamp(),
    last_error: '',
  });
}

async function failUpload(video: VideoRecord, error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Upload failed unexpectedly.';

  await markVideoState(video.video_id, 'failed', {
    last_attempted_at: createTimestamp(),
    last_error: message,
  });
}

async function recoverInProgressUploads() {
  const uploadingVideos = await getUploadingVideos();

  if (uploadingVideos.length === 0) {
    return 0;
  }

  await Promise.all(
    uploadingVideos.map(video =>
      markVideoState(video.video_id, 'pending', {
        last_error: 'Recovered after app restart',
      }),
    ),
  );

  return uploadingVideos.length;
}

export async function enqueueVideo(videoId: string) {
  const video = await getVideoById(videoId);

  if (!video) {
    throw new Error(`Video not found for enqueue: ${videoId}`);
  }

  if (video.upload_state === 'uploaded') {
    return video;
  }

  if (video.upload_state === 'failed') {
    const timestamp = createTimestamp();

    await markVideoState(video.video_id, 'pending', {
      last_error: '',
      last_attempted_at: timestamp,
    });
    return {
      ...video,
      upload_state: 'pending',
      last_error: '',
      last_attempted_at: timestamp,
    };
  }

  if (video.upload_state === 'uploading') {
    return video;
  }

  const timestamp = createTimestamp();

  await markVideoState(video.video_id, 'pending', {
    last_error: '',
    last_attempted_at: timestamp,
  });

  return {
    ...video,
    upload_state: 'pending',
    last_error: '',
    last_attempted_at: timestamp,
  };
}

export async function processQueue(
  processor: QueueProcessor,
): Promise<QueueProcessResult> {
  if (activeQueueRun) {
    return activeQueueRun;
  }

  activeQueueRun = (async () => {
    const recovered = await recoverInProgressUploads();
    const pendingVideos = await getPendingVideos();

    let processed = 0;
    let uploaded = 0;
    let failed = 0;

    for (const pendingVideo of pendingVideos) {
      const claimedVideo = await claimForUpload(pendingVideo);
      processed += 1;

      try {
        await processor(claimedVideo);
        await finishUpload(claimedVideo);
        uploaded += 1;
      } catch (error) {
        await failUpload(claimedVideo, error);
        failed += 1;
      }
    }

    return {
      processed,
      uploaded,
      failed,
      recovered,
    };
  })();

  try {
    return await activeQueueRun;
  } finally {
    activeQueueRun = null;
  }
}

export async function retryFailedUploads(
  processor: QueueProcessor,
): Promise<QueueProcessResult> {
  const failedVideos = await getFailedVideos();

  await Promise.all(
    failedVideos.map(video =>
      markVideoState(video.video_id, 'pending', {
        last_error: '',
        last_attempted_at: createTimestamp(),
      }),
    ),
  );

  return processQueue(processor);
}
