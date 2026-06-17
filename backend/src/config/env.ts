import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const env = {
  port: parsePositiveInteger(process.env.PORT, 3000),
  awsRegion: requireEnv('AWS_REGION'),
  s3BucketName: requireEnv('S3_BUCKET_NAME'),
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() ?? '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? '',
  awsSessionToken: process.env.AWS_SESSION_TOKEN?.trim() ?? '',
  presignedUrlExpiresInSeconds: parsePositiveInteger(
    process.env.PRESIGNED_URL_EXPIRES_IN_SECONDS,
    900,
  ),
};
