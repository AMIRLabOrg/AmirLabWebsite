"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiRequestError, apiRequest } from "@/lib/client-api";
import type { AuthenticatedUser } from "@/lib/types";

interface AuthState {
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthenticatedUser | null>;
  user: AuthenticatedUser | null;
}

interface AuthSession {
  csrfToken: string;
  user: AuthenticatedUser;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchAuthSession(): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/me", { method: "GET" });
}

function rememberCsrfToken(session: AuthSession): void {
  sessionStorage.setItem("amirl_csrf", session.csrfToken);
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      rememberCsrfToken(session);
      setUser(session.user);
      return session.user;
    } catch (caught) {
      if (isUnauthorized(caught)) {
        sessionStorage.removeItem("amirl_csrf");
        setUser(null);
        return null;
      }
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ signedOut: true }>("/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem("amirl_csrf");
      setUser(null);
      window.location.assign("/login");
    }
  }, []);

  useEffect(() => {
    let active = true;
    let retry: number | undefined;
    let attempts = 0;

    function loadSession() {
      attempts += 1;
      void fetchAuthSession()
        .then((session) => {
          if (!active) return;
          rememberCsrfToken(session);
          setUser(session.user);
          setLoading(false);
        })
        .catch((caught) => {
          if (!active) return;
          if (isUnauthorized(caught)) {
            sessionStorage.removeItem("amirl_csrf");
            setUser(null);
            setLoading(false);
            return;
          }
          if (attempts < 4) retry = window.setTimeout(loadSession, 1000);
          else setLoading(false);
        });
    }

    loadSession();
    return () => {
      active = false;
      if (retry) window.clearTimeout(retry);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ loading, logout, refreshUser, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
