import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../../constants/routes';
import { CameraScreen, DashboardScreen, HomeScreen, LoginScreen } from '../../screens';
import type { RootStackParamList } from '../../types/navigation';
import { appTheme } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.LOGIN}
      screenOptions={{
        headerStyle: {
          backgroundColor: appTheme.colors.surface,
        },
        headerTintColor: appTheme.colors.text,
        headerTitleAlign: 'center',
        contentStyle: {
          backgroundColor: appTheme.colors.background,
        },
      }}>
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={ROUTES.DASHBOARD} component={DashboardScreen} />
      <Stack.Screen name={ROUTES.HOME} component={HomeScreen} />
      <Stack.Screen name={ROUTES.CAMERA} component={CameraScreen} />
    </Stack.Navigator>
  );
}
