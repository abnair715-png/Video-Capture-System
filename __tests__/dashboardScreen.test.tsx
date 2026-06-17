import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockSampleVideo = {
  video_id: 'video_001',
  worker_id: 'worker_101',
  started_at: '2026-06-16T10:00:00.000Z',
  ended_at: '2026-06-16T10:00:20.000Z',
  duration_ms: 20000,
  file_size_bytes: 123456,
  fps: 30,
  fps_tier: 'standard',
  device_model: 'Pixel 8',
  os_version: '14',
  resolution: '1920x1080',
  local_path: 'file:///tmp/video_001.mp4',
  etag: '',
  metadata: '{}',
  upload_state: 'failed',
  attempt_count: 0,
  last_error: '',
  last_attempted_at: '',
};

jest.mock('../src/db/database', () => ({
  getVideosPaginated: jest.fn(async () => ({
    items: [mockSampleVideo],
    page: 1,
    pageSize: 10,
    totalCount: 1,
    hasNextPage: false,
  })),
  updateVideo: jest.fn(async () => undefined),
  deleteVideo: jest.fn(async () => undefined),
}));

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the video list and wires the actions', async () => {
    const { DashboardScreen } = require('../src/screens/DashboardScreen');
    const { deleteVideo, updateVideo } = require('../src/db/database');
    const RNFS = require('react-native-fs');

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<DashboardScreen />);
    });

    await ReactTestRenderer.act(async () => {
      await Promise.resolve();
    });

    const root = renderer!.root;

    expect(
      root.findAll(node => node.props?.children === 'Dashboard').length,
    ).toBeGreaterThan(0);
    expect(
      root.findAll(node => node.props?.children === '0:20').length,
    ).toBeGreaterThan(0);
    expect(
      root.findAll(node => node.props?.children === '121 KB').length,
    ).toBeGreaterThan(0);

    const pressables = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node.findAll(child => child.props?.children === 'Retry upload').length >
          0,
    );

    expect(pressables.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      pressables[0].props.onPress();
    });

    expect(updateVideo).toHaveBeenCalledWith('video_001', {
      upload_state: 'pending',
      attempt_count: 1,
      last_attempted_at: expect.any(String),
      last_error: '',
    });

    const deleteButtons = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node.findAll(child => child.props?.children === 'Delete local file')
          .length > 0,
    );

    expect(deleteButtons.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      deleteButtons[0].props.onPress();
    });

    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/video_001.mp4');
    expect(deleteVideo).toHaveBeenCalledWith('video_001');
    expect(
      root.findAll(node => node.props?.children === 'video_001').length,
    ).toBe(0);
  });
});
