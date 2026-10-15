import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, getStoredToken, setStoredToken } from "@/lib/api";
import { captureReferralCodeFromUrl, claimPendingReferral } from "@/lib/referrals";

export type AuthUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    captureReferralCodeFromUrl();
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiGet<AuthUser>("/auth/me")
      .then((me) => {
        setUser(me);
        void claimPendingReferral();
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await apiPost<{ user: AuthUser; token: string }>(
      "/auth/login",
      { email, password },
      false,
    );
    setStoredToken(data.token);
    setUser(data.user);
    void claimPendingReferral();
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const data = await apiPost<{ user: AuthUser; token: string }>(
      "/auth/register",
      { email, password, full_name: fullName },
      false,
    );
    setStoredToken(data.token);
    setUser(data.user);
    void claimPendingReferral();
  };

  const signInWithGoogle = async (credential: string) => {
    const data = await apiPost<{ user: AuthUser; token: string }>(
      "/auth/google",
      { credential },
      false,
    );
    setStoredToken(data.token);
    setUser(data.user);
    void claimPendingReferral();
  };

  const signOut = () => {
    setStoredToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const data = await apiGet<{ isAdmin: boolean }>("/profile/is-admin");
      return Boolean(data.isAdmin);
    },
  });
}

export { useAdminAccess, hasPermission, type AdminAccess, type PermissionKey } from "@/lib/admin-access";
