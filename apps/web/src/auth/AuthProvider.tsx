import type { UserDTO } from '@cv-studio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  setUser: (user: UserDTO | null) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const ME_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { setLocale } = useI18n();
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get<{ user: UserDTO | null }>('/api/auth/me').then((r) => r.user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const setUser = useCallback(
    (user: UserDTO | null) => {
      queryClient.setQueryData(ME_KEY, user);
    },
    [queryClient],
  );

  // UI-Sprache aus dem Benutzerkonto übernehmen
  const userLocale = query.data?.locale;
  useEffect(() => {
    if (userLocale) setLocale(userLocale);
  }, [userLocale, setLocale]);

  // Abgelaufene Sitzung (401) → Benutzer zurücksetzen
  useEffect(() => {
    const handler = () => {
      if (queryClient.getQueryData(ME_KEY)) queryClient.setQueryData(ME_KEY, null);
    };
    window.addEventListener('cvs:unauthorized', handler);
    return () => window.removeEventListener('cvs:unauthorized', handler);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      // Zuerst den Benutzer auf null setzen (aktive Beobachter werden benachrichtigt), danach alle
      // übrigen Daten des Kontos verwerfen. Ein vollständiges clear() würde die Me-Abfrage entfernen,
      // während ihr Beobachter noch den alten Benutzer hält.
      await queryClient.cancelQueries();
      queryClient.setQueryData(ME_KEY, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      try {
        // Lokale Entwurfssicherungen gehören zum Benutzer – beim Abmelden entfernen
        Object.keys(localStorage)
          .filter((k) => k.startsWith('cvs.draft.'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignorieren */
      }
    }
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ME_KEY });
  }, [queryClient]);

  const value = useMemo(
    () => ({ user: query.data ?? null, loading: query.isLoading, setUser, logout, refresh }),
    [query.data, query.isLoading, setUser, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb des AuthProvider');
  return ctx;
}
