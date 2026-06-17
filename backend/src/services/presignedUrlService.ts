import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

export type GeneratePresignedUrlInput = {
  workerId: string;
  videoId: string;
};

const s3Client = new S3Client({
  region: env.awsRegion,
  credentials:
    env.awsAccessKeyId && env.awsSecretAccessKey
      ? {
          accessKeyId: env.awsAccessKeyId,
          secretAccessKey: env.awsSecretAccessKey,
          sessionToken: env.awsSessionToken || undefined,
        }
      : undefined,
});

function buildObjectKey({ workerId, videoId }: GeneratePresignedUrlInput) {
  return `uploads/${workerId}/${videoId}.mp4`;
}

export async function generatePresignedUrl(
  input: GeneratePresignedUrlInput,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.s3BucketName,
    Key: buildObjectKey(input),
    ContentType: 'video/mp4',
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: env.presignedUrlExpiresInSeconds,
  });
}
