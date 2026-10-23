import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../api/client";
import type { SessionUser } from "../api/types";
import { useI18n, type Language } from "../i18n";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  updateSession: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: SessionUser["role"];
  language?: Language;
  author: { id: string } | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLanguage } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  // Any 401 from the API (expired token) signs the user out everywhere.
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // Restore the session on page load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<MeResponse>("/auth/me")
      .then((me) => {
        setUser({ id: me.id, name: me.name, email: me.email, role: me.role, authorId: me.author?.id ?? null });
        if (me.language) setLanguage(me.language);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout, setLanguage]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: SessionUser & { language?: Language } }>("/auth/login", { email, password });
    tokenStore.set(res.token);
    setUser(res.user);
    if (res.user.language) setLanguage(res.user.language);
    return res.user;
  }, [setLanguage]);

  const updateSession = useCallback((next: SessionUser) => setUser(next), []);

  const value = useMemo(
    () => ({ user, loading, login, logout, updateSession }),
    [user, loading, login, logout, updateSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
