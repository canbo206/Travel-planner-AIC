import type { UserSummary } from '@roadtrip/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { apiFetch, DEV_USER_KEY } from './api';
import { supabase } from './supabase';

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  /** Dev mode: username only. Supabase mode: email + password. */
  signIn: (username: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  mode: 'dev' | 'supabase';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserSummary>('/me').catch(() => null),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: me.data ?? null,
      loading: me.isLoading,
      mode: supabase ? 'supabase' : 'dev',
      async signIn(username, password) {
        if (supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email: username, password: password ?? '' });
          if (error) throw error;
        } else {
          localStorage.setItem(DEV_USER_KEY, username.trim());
        }
        await qc.resetQueries();
      },
      async signUp(email, password, username) {
        if (!supabase) {
          localStorage.setItem(DEV_USER_KEY, username.trim());
          await qc.resetQueries();
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;
        await qc.resetQueries();
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        localStorage.removeItem(DEV_USER_KEY);
        await qc.resetQueries();
      },
    }),
    [me.data, me.isLoading, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
