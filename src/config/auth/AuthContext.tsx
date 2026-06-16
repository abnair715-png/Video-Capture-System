import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSession, login as loginWithCredentials, logout as clearSession } from '../../services/authService';
import type { AuthContextValue, AuthSession, LoginCredentials } from '../../types/auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const storedSession = await getSession();
      if (isMounted) {
        setSession(storedSession);
        setIsLoading(false);
      }
    };

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      login: async (credentials: LoginCredentials) => {
        const nextSession = await loginWithCredentials(credentials);
        setSession(nextSession);
        return nextSession;
      },
      logout: async () => {
        await clearSession();
        setSession(null);
      },
      getSession,
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
