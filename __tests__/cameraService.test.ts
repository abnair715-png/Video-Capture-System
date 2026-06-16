import {
  MAX_RECORDING_DURATION_SECONDS,
  createVideoId,
  startRecording,
  stopRecording,
} from '../src/services/cameraService';

test('creates a valid uuid v4 video id', () => {
  const videoId = createVideoId();

  expect(videoId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('starts recording with a 60 second max duration and returns the file path', async () => {
  const createRecorder = jest.fn(async () => {
    let finishedPath = '';
    let finishedReason = 'stopped';

    return {
      isRecording: true,
      isPaused: false,
      recordedDuration: 0,
      recordedFileSize: 0,
      filePath: '/tmp/video.mp4',
      startRecording: jest.fn(async (onFinished) => {
        finishedPath = '/tmp/video.mp4';
        finishedReason = 'stopped';
        onFinished(finishedPath, finishedReason);
      }),
      stopRecording: jest.fn(async () => undefined),
      pauseRecording: jest.fn(async () => undefined),
      resumeRecording: jest.fn(async () => undefined),
      cancelRecording: jest.fn(async () => undefined),
    };
  });

  const videoOutput = {
    createRecorder,
  } as unknown as Parameters<typeof startRecording>[0];

  const session = await startRecording(videoOutput);

  expect(createRecorder).toHaveBeenCalledWith({
    maxDuration: MAX_RECORDING_DURATION_SECONDS,
  });

  await expect(stopRecording(session)).resolves.toBe('/tmp/video.mp4');
});
