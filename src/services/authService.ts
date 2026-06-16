import EncryptedStorage from 'react-native-encrypted-storage';
import { AUTH_CREDENTIALS, AUTH_STORAGE_KEY } from '../constants/auth';
import type { AuthSession, LoginCredentials } from '../types/auth';

function createSession(): AuthSession {
  return {
    email: AUTH_CREDENTIALS.email,
    workerId: AUTH_CREDENTIALS.workerId,
    loginAt: new Date().toISOString(),
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const isValid =
    credentials.email.trim().toLowerCase() === AUTH_CREDENTIALS.email &&
    credentials.password === AUTH_CREDENTIALS.password;

  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  const session = createSession();
  await EncryptedStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function logout(): Promise<void> {
  await EncryptedStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function getSession(): Promise<AuthSession | null> {
  const serializedSession = await EncryptedStorage.getItem(AUTH_STORAGE_KEY);

  if (!serializedSession) {
    return null;
  }

  try {
    return JSON.parse(serializedSession) as AuthSession;
  } catch {
    await EncryptedStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}
