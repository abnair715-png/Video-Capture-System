import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppScreen } from '../components';
import { useAuth } from '../config/auth';
import { appTheme } from '../config/theme';
import type { LoginCredentials } from '../types/auth';

const initialCredentials: LoginCredentials = {
  email: '',
  password: '',
};

export function LoginScreen() {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>(initialCredentials);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(credentials);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen
      title="Login"
      description="Enter the hardcoded mock credentials to continue.">
      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={appTheme.colors.mutedText}
          style={styles.input}
          value={credentials.email}
          onChangeText={text => setCredentials(current => ({ ...current, email: text }))}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          placeholder="Password"
          placeholderTextColor={appTheme.colors.mutedText}
          secureTextEntry
          style={styles.input}
          value={credentials.password}
          onChangeText={text => setCredentials(current => ({ ...current, password: text }))}
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
            isSubmitting ? styles.buttonDisabled : null,
          ]}
          disabled={isSubmitting}
          onPress={handleLogin}>
          {isSubmitting ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Text style={styles.helperText}>
          Credentials: admin@test.com / 123456
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
    marginTop: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: 12,
    backgroundColor: appTheme.colors.surface,
    color: appTheme.colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  actions: {
    marginTop: 16,
  },
  helperText: {
    color: appTheme.colors.mutedText,
    fontSize: 13,
  },
  button: {
    backgroundColor: appTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
});
