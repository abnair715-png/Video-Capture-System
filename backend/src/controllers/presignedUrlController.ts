import type { Request, Response } from 'express';
import { generatePresignedUrl } from '../services/presignedUrlService';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function generatePresignedUrlController(
  req: Request,
  res: Response,
) {
  const { worker_id, video_id } = req.body as {
    worker_id?: unknown;
    video_id?: unknown;
  };

  if (!isNonEmptyString(worker_id) || !isNonEmptyString(video_id)) {
    return res.status(400).json({
      message: 'worker_id and video_id are required.',
    });
  }

  try {
    const presignedUrl = await generatePresignedUrl({
      workerId: worker_id,
      videoId: video_id,
    });

    return res.status(200).json({ presignedUrl });
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return res.status(500).json({
      message: 'Unable to generate presigned URL.',
    });
  }
}
