import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../api/client";
import type { SessionUser } from "../api/types";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: SessionUser["role"];
  author: { id: string } | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
      .then((me) => setUser({ id: me.id, name: me.name, email: me.email, role: me.role, authorId: me.author?.id ?? null }))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: SessionUser }>("/auth/login", { email, password });
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
