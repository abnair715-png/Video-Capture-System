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
