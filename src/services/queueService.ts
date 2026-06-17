import {
  getFailedVideos,
  getPendingVideos,
  getUploadingVideos,
  getVideoById,
  updateVideo,
} from '../db/database';
import type { VideoRecord } from '../models/video';
import { isVideoRetryDue } from './retryPolicy';

export type QueueProcessor = (video: VideoRecord) => Promise<void>;

export type QueueProcessOptions = {
  force?: boolean;
};

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

async function recoverInProgressUploads() {
  const uploadingVideos = await getUploadingVideos();

  if (uploadingVideos.length === 0) {
    return 0;
  }

  await Promise.all(
    uploadingVideos.map(video =>
      updateVideo(video.video_id, {
        upload_state: 'pending',
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

  const timestamp = createTimestamp();

  if (video.upload_state === 'failed' || video.upload_state === 'uploading') {
    await updateVideo(video.video_id, {
      upload_state: 'pending',
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

  await updateVideo(video.video_id, {
    upload_state: 'pending',
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
  options: QueueProcessOptions = {},
): Promise<QueueProcessResult> {
  if (activeQueueRun) {
    return activeQueueRun;
  }

  activeQueueRun = (async () => {
    const recovered = await recoverInProgressUploads();
    const pendingVideos = await getPendingVideos();
    const dueVideos = options.force
      ? pendingVideos
      : pendingVideos.filter(video => isVideoRetryDue(video));

    let processed = 0;
    let uploaded = 0;
    let failed = 0;

    for (const pendingVideo of dueVideos) {
      processed += 1;

      try {
        await processor(pendingVideo);
        uploaded += 1;
      } catch {
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
      updateVideo(video.video_id, {
        upload_state: 'pending',
        last_error: '',
        last_attempted_at: createTimestamp(),
      }),
    ),
  );

  return processQueue(processor, { force: true });
}

export async function resumeQueuedUploads(
  processor: QueueProcessor,
): Promise<QueueProcessResult> {
  const [pendingVideos, failedVideos] = await Promise.all([
    getPendingVideos(),
    getFailedVideos(),
  ]);

  console.log('[Queue] Resuming queued uploads', {
    pending: pendingVideos.length,
    failed: failedVideos.length,
  });

  if (pendingVideos.length === 0 && failedVideos.length === 0) {
    return {
      processed: 0,
      uploaded: 0,
      failed: 0,
      recovered: 0,
    };
  }

  if (failedVideos.length > 0) {
    return retryFailedUploads(processor);
  }

  return processQueue(processor);
}
