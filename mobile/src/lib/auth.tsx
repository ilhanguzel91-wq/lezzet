import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setApiToken } from './api';
import type { Rewards, User } from './types';

const TOKEN_KEY = 'lezzetrotasi.token';

type AuthState = {
  ready: boolean;
  user: User | null;
  rewards: Rewards | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rewards, setRewards] = useState<Rewards | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User; rewards: Rewards }>('/me');
      setUser(me.user);
      setRewards(me.rewards);
    } catch {
      setApiToken(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setUser(null);
      setRewards(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        setApiToken(token);
        await refresh();
      }
      setReady(true);
    })();
  }, [refresh]);

  const accept = useCallback(
    async (r: { token: string }) => {
      setApiToken(r.token);
      await SecureStore.setItemAsync(TOKEN_KEY, r.token);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      rewards,
      refresh,
      login: async (email, password) => accept(await api<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } })),
      register: async (name, email, password) =>
        accept(await api<{ token: string }>('/auth/register', { method: 'POST', body: { name, email, password } })),
      logout: async () => {
        setApiToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setUser(null);
        setRewards(null);
      },
    }),
    [ready, user, rewards, refresh, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
