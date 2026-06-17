import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children }) => React.createElement(View, null, children),
    useSafeAreaInsets: () => ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    }),
  };
});

jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockComponent = ({ children }) =>
    React.createElement(View, null, children);

  return {
    enableScreens: jest.fn(),
    Screen: MockComponent,
    ScreenContainer: MockComponent,
    ScreenStack: MockComponent,
    ScreenStackHeaderConfig: MockComponent,
  };
});

jest.mock('react-native-encrypted-storage', () => {
  const store = new Map();

  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      getItem: jest.fn(async key => store.get(key) ?? null),
      removeItem: jest.fn(async key => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getModel: jest.fn(() => 'Pixel 8'),
    getSystemVersion: jest.fn(() => '14'),
    getBatteryLevel: jest.fn(async () => 0.75),
  },
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn(async () => true),
  readFile: jest.fn(async () => 'ZmFrZS12aWRlby1ieXRlcw=='),
  stat: jest.fn(async filepath => ({
    path: filepath,
    size: 123456,
    name: 'mock-video.mp4',
    mode: 0,
    ctime: 0,
    mtime: 0,
    originalFilepath: filepath,
    isFile: () => true,
    isDirectory: () => false,
  })),
  unlink: jest.fn(async () => undefined),
  uploadFiles: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({
      jobId: 1,
      statusCode: 200,
      headers: {
        ETag: '"mock-etag"',
      },
      body: '',
    }),
  })),
}));

global.fetch = jest.fn(async input => {
  const url = typeof input === 'string' ? input : input?.url ?? '';
  const method =
    typeof input === 'string' ? 'GET' : input?.method?.toUpperCase() ?? 'GET';

  if (url.includes('/generate-presigned-url')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        presignedUrl: 'https://example.com/presigned-url',
      }),
    };
  }

  if (method === 'PUT') {
    return {
      ok: true,
      status: 200,
      text: async () => '',
      headers: {
        entries: function* () {
          yield ['etag', '"mock-etag"'];
        },
        get: key => (String(key).toLowerCase() === 'etag' ? '"mock-etag"' : null),
      },
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    headers: {
      entries: function* () {
        return;
      },
      get: () => null,
    },
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: null,
    })),
  },
}));

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn((success, error) => {
      if (typeof success === 'function') {
        success({
          coords: {
            latitude: 12.9716,
            longitude: 77.5946,
          },
        });
      } else if (typeof error === 'function') {
        error({ code: 1, message: 'No callback provided' });
      }
    }),
  },
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    NavigationContainer: ({ children }) =>
      React.createElement(View, null, children),
    useIsFocused: () => true,
    DefaultTheme: {
      colors: {
        background: '#000000',
        card: '#111111',
        text: '#ffffff',
        border: '#222222',
        primary: '#00aaff',
        notification: '#ff0000',
      },
    },
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Navigator = ({ children }) => React.createElement(View, null, children);
  const Screen = ({ children }) => React.createElement(View, null, children);

  return {
    createNativeStackNavigator: () => ({
      Navigator,
      Screen,
    }),
  };
});

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const { View } = require('react-native');

  const FlatListMock = ({
    data = [],
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
  }) =>
    React.createElement(
      View,
      null,
      data.length > 0
        ? data.map((item, index) => {
            if (!renderItem) {
              return null;
            }

            const element = renderItem({ item, index });
            return React.isValidElement(element)
              ? React.cloneElement(element, {
                  key: item?.video_id ?? index,
                })
              : element;
          })
        : ListEmptyComponent ?? null,
      ListFooterComponent ?? null,
    );

  return {
    __esModule: true,
    default: FlatListMock,
  };
});

jest.mock('react-native-quick-sqlite', () => {
  const createRows = rows => ({
    _array: rows,
    length: rows.length,
    item: index => rows[index],
  });

  const createResult = rows => ({
    rowsAffected: 0,
    rows: createRows(rows),
  });

  const connection = {
    executeAsync: jest.fn(async query => {
      if (String(query).includes('PRAGMA table_info')) {
        return createResult([
          { name: 'video_id' },
          { name: 'worker_id' },
          { name: 'started_at' },
          { name: 'ended_at' },
          { name: 'duration_ms' },
          { name: 'file_size_bytes' },
          { name: 'fps' },
          { name: 'fps_tier' },
          { name: 'device_model' },
          { name: 'os_version' },
          { name: 'resolution' },
          { name: 'local_path' },
          { name: 'etag' },
          { name: 'metadata' },
          { name: 'upload_state' },
          { name: 'attempt_count' },
          { name: 'last_error' },
          { name: 'last_attempted_at' },
        ]);
      }

      if (String(query).includes('COUNT(*)')) {
        return createResult([{ count: 0 }]);
      }

      return createResult([]);
    }),
    executeBatchAsync: jest.fn(async () => ({ rowsAffected: 0 })),
    execute: jest.fn(() => createResult([])),
    executeBatch: jest.fn(() => ({ rowsAffected: 0 })),
    transaction: jest.fn(async fn => {
      await fn({
        commit: jest.fn(() => createResult([])),
        rollback: jest.fn(() => createResult([])),
        execute: jest.fn(() => createResult([])),
        executeAsync: jest.fn(async () => createResult([])),
      });
    }),
    close: jest.fn(),
    delete: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
    loadFile: jest.fn(() => ({ rowsAffected: 0 })),
    loadFileAsync: jest.fn(async () => ({ rowsAffected: 0 })),
  };

  return {
    open: jest.fn(() => connection),
    QuickSQLite: connection,
  };
});

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Camera = ({ children }) => React.createElement(View, null, children);

  return {
    Camera,
    useCameraPermission: () => ({
      hasPermission: true,
      canRequestPermission: false,
      status: 'authorized',
      requestPermission: jest.fn(async () => true),
    }),
    useCameraDevice: () => ({ id: 'mock-device' }),
    useVideoOutput: () => ({
      createRecorder: jest.fn(async () => ({
        isRecording: true,
        isPaused: false,
        recordedDuration: 0,
        recordedFileSize: 0,
        filePath: '/tmp/mock-video.mp4',
        startRecording: jest.fn(async (onFinished) => {
          onFinished('/tmp/mock-video.mp4', 'stopped');
        }),
        stopRecording: jest.fn(async () => undefined),
        pauseRecording: jest.fn(async () => undefined),
        resumeRecording: jest.fn(async () => undefined),
        cancelRecording: jest.fn(async () => undefined),
      })),
    }),
    CommonResolutions: {
      FHD_16_9: { width: 1080, height: 1920 },
    },
  };
});
