import type { VideoRecord } from '../models/video';

export const RETRY_BACKOFF_SECONDS = [2, 4, 8, 16, 32, 64] as const;
export const MAX_RETRY_COUNT = RETRY_BACKOFF_SECONDS.length;

export function getRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 0) {
    return 0;
  }

  const backoffIndex = Math.min(attemptCount - 1, RETRY_BACKOFF_SECONDS.length - 1);
  return RETRY_BACKOFF_SECONDS[backoffIndex] * 1000;
}

export function isVideoRetryDue(
  video: Pick<VideoRecord, 'attempt_count' | 'last_attempted_at' | 'upload_state'>,
  now = Date.now(),
) {
  if (video.upload_state !== 'pending') {
    return false;
  }

  if (video.attempt_count <= 0) {
    return true;
  }

  if (video.attempt_count > MAX_RETRY_COUNT) {
    return false;
  }

  const lastAttemptAt = Date.parse(video.last_attempted_at);

  if (!Number.isFinite(lastAttemptAt)) {
    return true;
  }

  return now - lastAttemptAt >= getRetryDelayMs(video.attempt_count);
}

export function shouldMarkFailedAfterAttempt(attemptCount: number) {
  return attemptCount > MAX_RETRY_COUNT;
}
