import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components';
import { ROUTES } from '../constants/routes';
import type { AppScreenProps } from '../types/navigation';
import { appTheme } from '../config/theme';

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  return (
    <AppScreen
      title="Login"
      description="Authentication flow placeholder with no business logic yet. Use these temporary buttons to move between screens.">
      <View style={styles.actions}>
        <NavButton label="Go to Home" onPress={() => navigation.navigate(ROUTES.HOME)} />
        <NavButton
          label="Go to Dashboard"
          onPress={() => navigation.navigate(ROUTES.DASHBOARD)}
        />
        <NavButton
          label="Go to Camera"
          onPress={() => navigation.navigate(ROUTES.CAMERA)}
        />
      </View>
    </AppScreen>
  );
}

type NavButtonProps = {
  label: string;
  onPress: () => void;
};

function NavButton({ label, onPress }: NavButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  button: {
    backgroundColor: appTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
