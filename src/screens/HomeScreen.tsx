import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../config/auth';
// import { getAllVideos, getVideoCount } from '../db/database';
import { appTheme } from '../config/theme';
import type { AppScreenProps } from '../types/navigation';

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const { session, logout } = useAuth();

  // const handleDebugDatabase = async () => {
  //   const [count, videos] = await Promise.all([
  //     getVideoCount(),
  //     getAllVideos(),
  //   ]);

  //   console.log('[SQLite Debug] Debug button count:', count);
  //   console.log('[SQLite Debug] Debug button rows:', videos);
  // };

  return (
    <AppScreen
      title="Home"
      description={`Welcome${
        session ? `, ${session.workerId}` : ''
      }. This is the authenticated landing screen.`}
    >
      <Text style={styles.sessionText}>Email: {session?.email}</Text>
      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate(ROUTES.CAMERA)}
        >
          <Text style={styles.primaryButtonText}>Open Camera</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate(ROUTES.DASHBOARD)}
        >
          <Text style={styles.secondaryButtonText}>Open Dashboard</Text>
        </Pressable>
        {/* <Pressable style={styles.debugButton} onPress={handleDebugDatabase}>
          <Text style={styles.debugButtonText}>Debug Database</Text>
        </Pressable> */}
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sessionText: {
    color: appTheme.colors.mutedText,
    fontSize: 14,
    marginBottom: 16,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: appTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: appTheme.colors.surface,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: appTheme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#C4B5FD',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
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
