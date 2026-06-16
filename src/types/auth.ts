export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthSession = {
  email: string;
  workerId: string;
  loginAt: string;
};

export type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  logout: () => Promise<void>;
  getSession: () => Promise<AuthSession | null>;
};
