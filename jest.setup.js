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

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    NavigationContainer: ({ children }) =>
      React.createElement(View, null, children),
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
