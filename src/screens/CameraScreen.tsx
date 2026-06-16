import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useVideoOutput } from 'react-native-vision-camera';
import { appTheme } from '../config/theme';
import {
  MAX_RECORDING_DURATION_SECONDS,
  startRecording,
  stopRecording,
  type CameraRecordingSession,
} from '../services/cameraService';
import type { CameraLens } from '../types/camera';

export function CameraScreen() {
  const isFocused = useIsFocused();
  const [lens, setLens] = useState<CameraLens>('back');
  const [recordingSession, setRecordingSession] =
    useState<CameraRecordingSession | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedFilePath, setRecordedFilePath] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const cameraPermission = useCameraPermission();
  const device = useCameraDevice(lens);
  const videoOutput = useVideoOutput({
    enableAudio: false,
  });
  const sessionRef = useRef<CameraRecordingSession | null>(null);

  const isRecording = recordingSession != null;

  const handleStopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }

    sessionRef.current = null;
    setRecordingSession(null);

    try {
      const filePath = await stopRecording(session);
      if (filePath) {
        setRecordedFilePath(filePath);
      }
    } catch (error) {
      setRecordingError(
        error instanceof Error ? error.message : 'Unable to stop recording.',
      );
    }
  }, []);

  useEffect(() => {
    sessionRef.current = recordingSession;
  }, [recordingSession]);

  useEffect(() => {
    if (!recordingSession) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const nextElapsedSeconds = Math.min(
        MAX_RECORDING_DURATION_SECONDS,
        Math.floor((Date.now() - startedAt) / 1000),
      );
      setElapsedSeconds(nextElapsedSeconds);

      if (
        nextElapsedSeconds >= MAX_RECORDING_DURATION_SECONDS &&
        sessionRef.current
      ) {
        void handleStopRecording();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [recordingSession, handleStopRecording]);

  const handleStartRecording = useCallback(async () => {
    setRecordingError('');
    setRecordedFilePath('');
    setIsStarting(true);

    try {
      const session = await startRecording(videoOutput);
      sessionRef.current = session;
      setRecordingSession(session);
      setCurrentVideoId(session.videoId);

      session.filePathPromise
        .then(filePath => {
          setRecordedFilePath(filePath);
        })
        .catch(error => {
          setRecordingError(
            error instanceof Error ? error.message : 'Recording failed.',
          );
        })
        .finally(() => {
          sessionRef.current = null;
          setRecordingSession(null);
          setElapsedSeconds(0);
        });
    } catch (error) {
      setRecordingError(
        error instanceof Error ? error.message : 'Unable to start recording.',
      );
    } finally {
      setIsStarting(false);
    }
  }, [videoOutput]);

  const handleToggleLens = useCallback(() => {
    setLens(currentLens => (currentLens === 'back' ? 'front' : 'back'));
  }, []);

  const handleRequestPermission = useCallback(async () => {
    await cameraPermission.requestPermission();
  }, [cameraPermission]);

  const timerText = useMemo(() => formatDuration(elapsedSeconds), [elapsedSeconds]);

  return (
    <View style={styles.container}>
      <View style={styles.previewContainer}>
        {cameraPermission.hasPermission && device != null && isFocused ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            outputs={[videoOutput]}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>Camera Preview</Text>
            <Text style={styles.placeholderText}>
              {cameraPermission.hasPermission
                ? 'No camera device found.'
                : 'Camera permission is required to start recording.'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.title}>Recording</Text>
        <Text style={styles.timer}>{timerText} / 01:00</Text>
        <Text style={styles.meta}>Video ID: {currentVideoId || '—'}</Text>
        <Text style={styles.meta}>
          Last file: {recordedFilePath || 'No recording yet'}
        </Text>
        {recordingError ? <Text style={styles.error}>{recordingError}</Text> : null}
      </View>

      <View style={styles.controls}>
        {!cameraPermission.hasPermission ? (
          <Pressable style={styles.primaryButton} onPress={handleRequestPermission}>
            <Text style={styles.buttonText}>Grant Camera Permission</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[
                styles.secondaryButton,
                isRecording || isStarting ? styles.disabledButton : null,
              ]}
              disabled={isRecording || isStarting}
              onPress={handleToggleLens}>
              <Text style={styles.buttonText}>
                Switch to {lens === 'back' ? 'Front' : 'Rear'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryButton,
                isRecording ? styles.stopButton : null,
                isStarting ? styles.disabledButton : null,
              ]}
              disabled={isStarting}
              onPress={isRecording ? handleStopRecording : handleStartRecording}>
              {isStarting ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.buttonText}>
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: {
    color: appTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeholderText: {
    color: appTheme.colors.mutedText,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    gap: 6,
  },
  title: {
    color: appTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  timer: {
    color: appTheme.colors.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  meta: {
    color: appTheme.colors.mutedText,
    fontSize: 13,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 13,
    marginTop: 4,
  },
  controls: {
    padding: 20,
    gap: 12,
    backgroundColor: appTheme.colors.background,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.primary,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
  },
  stopButton: {
    backgroundColor: '#FCA5A5',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
});
