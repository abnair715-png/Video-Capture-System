import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../../constants/routes';
import { CameraScreen, DashboardScreen, HomeScreen, LoginScreen } from '../../screens';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../auth';
import { appTheme } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return (
      <Stack.Navigator
        key="auth"
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
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      key="app"
      initialRouteName={ROUTES.HOME}
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
      <Stack.Screen name={ROUTES.DASHBOARD} component={DashboardScreen} />
      <Stack.Screen name={ROUTES.HOME} component={HomeScreen} />
      <Stack.Screen name={ROUTES.CAMERA} component={CameraScreen} />
    </Stack.Navigator>
  );
}
