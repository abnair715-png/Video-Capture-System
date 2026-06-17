import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appTheme } from '../config/theme';
import {
  getVideoById,
  getVideosPaginated,
  updateVideo,
} from '../db/database';
import type { VideoRecord } from '../models/video';
import { processUploadQueue, uploadVideo } from '../services/uploadService';
import * as RNFS from 'react-native-fs';

const PAGE_SIZE = 10;

type DashboardState = {
  items: VideoRecord[];
  page: number;
  hasNextPage: boolean;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string;
};

type VideoActionState = {
  retrying: boolean;
  deleting: boolean;
};

const initialState: DashboardState = {
  items: [],
  page: 0,
  hasNextPage: true,
  isInitialLoading: true,
  isLoadingMore: false,
  isRefreshing: false,
  error: '',
};

const uploadStatePalette: Record<
  string,
  { background: string; text: string; label: string }
> = {
  pending: {
    background: '#FEF3C7',
    text: '#92400E',
    label: 'PENDING',
  },
  uploading: {
    background: '#DBEAFE',
    text: '#1D4ED8',
    label: 'UPLOADING',
  },
  uploaded: {
    background: '#D1FAE5',
    text: '#047857',
    label: 'UPLOADED',
  },
  failed: {
    background: '#FEE2E2',
    text: '#B91C1C',
    label: 'FAILED',
  },
  default: {
    background: appTheme.colors.surface,
    text: appTheme.colors.text,
    label: 'UNKNOWN',
  },
};

function normalizeState(uploadState: string) {
  return uploadState.trim().toLowerCase();
}

function formatDuration(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const size = bytes / 1024 ** unitIndex;

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
}

function normalizeLocalPath(localPath: string) {
  const withoutScheme = localPath.startsWith('file://')
    ? localPath.replace(/^file:\/\//, '')
    : localPath;

  try {
    return decodeURI(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

async function deleteLocalFileSafely(localPath: string) {
  const normalizedPath = normalizeLocalPath(localPath);

  try {
    const exists = await RNFS.exists(normalizedPath);

    if (!exists) {
      return;
    }

    await RNFS.unlink(normalizedPath);
  } catch (error) {
    console.log('[Dashboard] Local file deletion skipped/failed:', {
      localPath,
      normalizedPath,
      error,
    });
    throw error;
  }
}

export function DashboardScreen() {
  const [state, setState] = useState<DashboardState>(initialState);
  const [actionStateById, setActionStateById] = useState<
    Record<string, VideoActionState>
  >({});

  const loadPage = useCallback(
    async (pageToLoad: number, reset = false) => {
      try {
        setState(currentState => ({
          ...currentState,
          error: '',
          isInitialLoading: reset ? true : currentState.isInitialLoading,
          isLoadingMore: !reset && pageToLoad > 1,
          isRefreshing: reset && currentState.items.length > 0,
        }));

        const result = await getVideosPaginated(pageToLoad, PAGE_SIZE);

        setState(currentState => ({
          ...currentState,
          items: reset ? result.items : [...currentState.items, ...result.items],
          page: result.page,
          hasNextPage: result.hasNextPage,
          isInitialLoading: false,
          isLoadingMore: false,
          isRefreshing: false,
        }));
      } catch (error) {
        setState(currentState => ({
          ...currentState,
          error:
            error instanceof Error ? error.message : 'Unable to load videos.',
          isInitialLoading: false,
          isLoadingMore: false,
          isRefreshing: false,
        }));
      }
    },
    [],
  );

  const updateVideoInState = useCallback(
    (videoId: string, updater: (video: VideoRecord) => VideoRecord) => {
      setState(currentState => ({
        ...currentState,
        items: currentState.items.map(video =>
          video.video_id === videoId ? updater(video) : video,
        ),
      }));
    },
    [],
  );

  const setActionState = useCallback(
    (videoId: string, patch: Partial<VideoActionState>) => {
      setActionStateById(currentState => {
        const current = currentState[videoId] ?? {
          retrying: false,
          deleting: false,
        };

        return {
          ...currentState,
          [videoId]: {
            ...current,
            ...patch,
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  const handleRefresh = useCallback(() => {
    void (async () => {
      await processUploadQueue();
      await loadPage(1, true);
    })();
  }, [loadPage]);

  const handleLoadMore = useCallback(() => {
    if (state.isLoadingMore || state.isInitialLoading || !state.hasNextPage) {
      return;
    }

    void loadPage(state.page + 1, false);
  }, [loadPage, state.hasNextPage, state.isInitialLoading, state.isLoadingMore, state.page]);

  const handleRetryUpload = useCallback(async (video: VideoRecord) => {
    const normalizedState = normalizeState(video.upload_state);
    const hasLocalFile = video.local_path.trim().length > 0;

    if (normalizedState !== 'failed' || !hasLocalFile) {
      return;
    }

    setActionState(video.video_id, { retrying: true });
    const lastAttemptedAt = new Date().toISOString();

    updateVideoInState(video.video_id, currentVideo => ({
      ...currentVideo,
      upload_state: 'uploading',
      attempt_count: currentVideo.attempt_count + 1,
      last_attempted_at: lastAttemptedAt,
      last_error: '',
    }));

    try {
      const updatedVideo = await uploadVideo(video);
      updateVideoInState(video.video_id, () => updatedVideo);
      console.log('[Dashboard] Retry upload triggered for:', video.video_id);
    } catch (error) {
      const latestVideo = await getVideoById(video.video_id);
      if (latestVideo) {
        updateVideoInState(video.video_id, () => latestVideo);
      }
      console.log('[Dashboard] Retry upload failed for:', video.video_id, error);
    } finally {
      setActionState(video.video_id, { retrying: false });
    }
  }, [setActionState, updateVideoInState]);

  const handleDeleteLocalFile = useCallback(async (video: VideoRecord) => {
    if (!video.local_path) {
      return;
    }

    setActionState(video.video_id, { deleting: true });
    const previousVideo = video;
    const lastAttemptedAt = new Date().toISOString();
    const normalizedState = normalizeState(video.upload_state);
    const nextUploadState = normalizedState === 'uploaded' ? 'uploaded' : 'failed';

    try {
      await deleteLocalFileSafely(video.local_path);
      await updateVideo(video.video_id, {
        local_path: '',
        upload_state: nextUploadState,
        last_error: 'Local file deleted',
        last_attempted_at: lastAttemptedAt,
      });
      updateVideoInState(video.video_id, currentVideo => ({
        ...currentVideo,
        local_path: '',
        upload_state: nextUploadState,
        last_error: 'Local file deleted',
        last_attempted_at: lastAttemptedAt,
      }));
      console.log('[Dashboard] Deleted local file:', video.local_path);
    } catch (error) {
      updateVideoInState(video.video_id, () => previousVideo);
      console.log('[Dashboard] Failed to delete local file:', error);
    } finally {
      setActionState(video.video_id, { deleting: false });
    }
  }, [setActionState, updateVideoInState]);

  const renderItem = useCallback(
    ({ item }: { item: VideoRecord }) => {
      const normalizedState = normalizeState(item.upload_state);
      const palette =
        uploadStatePalette[normalizedState] ?? uploadStatePalette.default;
      const actionState = actionStateById[item.video_id] ?? {
        retrying: false,
        deleting: false,
      };
      const hasLocalFile = item.local_path.trim().length > 0;
      const canRetry = normalizedState === 'failed' && hasLocalFile;

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.videoId}>{item.video_id}</Text>
            <View
              style={[
                styles.stateBadge,
                {
                  backgroundColor: palette.background,
                },
              ]}>
              <Text style={[styles.stateText, { color: palette.text }]}>
                {palette.label}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{formatDuration(item.duration_ms)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>File size</Text>
            <Text style={styles.metaValue}>
              {formatFileSize(item.file_size_bytes)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>FPS tier</Text>
            <Text style={styles.metaValue}>{item.fps_tier || '—'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Upload state</Text>
            <Text style={styles.metaValue}>{palette.label}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Local file</Text>
            <Text style={styles.metaValue}>
              {hasLocalFile ? 'Available' : 'Deleted'}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[
                styles.retryButton,
                actionState.retrying || actionState.deleting
                  ? styles.disabledButton
                  : null,
              ]}
              disabled={actionState.retrying || actionState.deleting || !canRetry}
              onPress={() => void handleRetryUpload(item)}>
              <Text style={styles.retryButtonText}>
                {actionState.retrying ? 'Retrying...' : 'Retry upload'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.deleteButton,
                actionState.retrying || actionState.deleting
                  ? styles.disabledButton
                  : null,
              ]}
              disabled={actionState.retrying || actionState.deleting || !hasLocalFile}
              onPress={() => void handleDeleteLocalFile(item)}>
              <Text style={styles.deleteButtonText}>
                {actionState.deleting ? 'Deleting...' : 'Delete local file'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.actionStatus}>
            {actionState.retrying
              ? 'Retry queued and syncing...'
              : actionState.deleting
                ? 'Deleting local file...'
                : hasLocalFile
                  ? 'Local file ready'
                  : 'Local file deleted'}
          </Text>
        </View>
      );
    },
    [actionStateById, handleDeleteLocalFile, handleRetryUpload],
  );

  const listFooter = useMemo(() => {
    if (state.isLoadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={appTheme.colors.primary} />
        </View>
      );
    }

    if (!state.hasNextPage && state.items.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>No more videos to load.</Text>
        </View>
      );
    }

    return <View style={styles.footerSpacer} />;
  }, [state.hasNextPage, state.isLoadingMore, state.items.length]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.description}>
        Browse captured videos and manage upload status.
      </Text>

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      {state.isInitialLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={appTheme.colors.primary} />
        </View>
      ) : (
          <FlatList
          data={state.items}
          keyExtractor={item => item.video_id}
          renderItem={renderItem}
          style={styles.list}
          extraData={actionStateById}
          contentContainerStyle={
            state.items.length === 0 ? styles.emptyContainer : styles.listContent
          }
          refreshing={state.isRefreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No videos yet</Text>
              <Text style={styles.emptyText}>
                Recorded videos will appear here after they are saved.
              </Text>
            </View>
          }
          ListFooterComponent={listFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
    padding: 24,
  },
  title: {
    color: appTheme.colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: appTheme.colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  error: {
    color: '#FCA5A5',
    marginBottom: 12,
    fontSize: 13,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  list: {
    flex: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: appTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: appTheme.colors.mutedText,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: appTheme.colors.surface,
    borderColor: appTheme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  videoId: {
    color: appTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stateText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    color: appTheme.colors.mutedText,
    fontSize: 13,
  },
  metaValue: {
    color: appTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  retryButton: {
    flex: 1,
    backgroundColor: appTheme.colors.primary,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '700',
  },
  actionStatus: {
    color: appTheme.colors.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  disabledButton: {
    opacity: 0.7,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    color: appTheme.colors.mutedText,
    fontSize: 12,
  },
  footerSpacer: {
    height: 16,
  },
});
