import type {
  CameraVideoOutput,
  Recorder,
  RecordingFinishedReason,
} from 'react-native-vision-camera';
import { appConfig } from '../config/appConfig';

export const MAX_RECORDING_DURATION_SECONDS =
  appConfig.maxRecordingDurationSeconds;

export type StartRecordingOptions = {
  maxDurationSeconds?: number;
};

export type CameraRecordingSession = {
  videoId: string;
  startedAt: string;
  recorder: Recorder;
  filePathPromise: Promise<string>;
  stop: () => Promise<string>;
};

function randomByte() {
  const cryptoApi = globalThis as unknown as {
    crypto?: {
      getRandomValues?: (values: Uint8Array) => Uint8Array;
    };
  };
  const randomValues = cryptoApi.crypto?.getRandomValues;

  if (typeof randomValues === 'function') {
    const buffer = new Uint8Array(1);
    randomValues.call(cryptoApi.crypto, buffer);
    return buffer[0] ?? 0;
  }

  return Math.floor(Math.random() * 256);
}

export function createVideoId() {
  const bytes = Array.from({ length: 16 }, () => randomByte());

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map(byte => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function createFilePathPromise() {
  let resolveFilePath: (filePath: string) => void = () => undefined;
  let rejectFilePath: (error: Error) => void = () => undefined;

  const filePathPromise = new Promise<string>((resolve, reject) => {
    resolveFilePath = resolve;
    rejectFilePath = reject;
  });

  return {
    filePathPromise,
    resolveFilePath,
    rejectFilePath,
  };
}

export async function startRecording(
  videoOutput: CameraVideoOutput,
  options: StartRecordingOptions = {},
): Promise<CameraRecordingSession> {
  const videoId = createVideoId();
  const startedAt = new Date().toISOString();
  const maxDurationSeconds =
    options.maxDurationSeconds ?? appConfig.maxRecordingDurationSeconds;
  const recorder = await videoOutput.createRecorder({
    maxDuration: maxDurationSeconds,
  });
  const { filePathPromise, resolveFilePath, rejectFilePath } =
    createFilePathPromise();

  await recorder.startRecording(
    (filePath: string, reason: RecordingFinishedReason) => {
      resolveFilePath(filePath);

      if (reason === 'max-duration-reached') {
        return;
      }
    },
    (error: Error) => {
      rejectFilePath(error);
    },
  );

  return {
    videoId,
    startedAt,
    recorder,
    filePathPromise,
    stop: async () => {
      if (recorder.isRecording) {
        try {
          await recorder.stopRecording();
        } catch {
          // The recording can already be stopped by the native max-duration guard.
        }
      }

      return filePathPromise;
    },
  };
}

export async function stopRecording(
  session: CameraRecordingSession | null,
): Promise<string | null> {
  if (!session) {
    return null;
  }

  return session.stop();
}
