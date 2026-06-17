import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { RequestChecksumCalculation } from '@aws-sdk/middleware-flexible-checksums';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

export type GeneratePresignedUrlInput = {
  workerId: string;
  videoId: string;
};

const s3Client = new S3Client({
  region: env.awsRegion,
  requestChecksumCalculation: RequestChecksumCalculation.WHEN_REQUIRED,
  credentials:
    env.awsAccessKeyId && env.awsSecretAccessKey
      ? {
          accessKeyId: env.awsAccessKeyId,
          secretAccessKey: env.awsSecretAccessKey,
          sessionToken: env.awsSessionToken || undefined,
        }
      : undefined,
});

function buildObjectKey(input: GeneratePresignedUrlInput) {
  return `uploads/${input.workerId}/${input.videoId}`;
}

export async function generatePresignedUrl(
  input: GeneratePresignedUrlInput,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.s3BucketName,
    Key: buildObjectKey(input),
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: env.presignedUrlExpiresInSeconds,
  });
}
