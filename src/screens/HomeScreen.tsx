import { Pressable, StyleSheet, Text } from 'react-native';
import { AppScreen } from '../components';
import { useAuth } from '../config/auth';
import { appTheme } from '../config/theme';

export function HomeScreen() {
  const { session, logout } = useAuth();

  return (
    <AppScreen
      title="Home"
      description={`Welcome${session ? `, ${session.workerId}` : ''}. This is the authenticated landing screen.`}>
      <Text style={styles.sessionText}>Email: {session?.email}</Text>
      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sessionText: {
    color: appTheme.colors.mutedText,
    fontSize: 14,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
});
