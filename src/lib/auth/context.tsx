"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Recovery emails triggered from the Supabase Dashboard use the classic
    // implicit flow (#access_token=...&refresh_token=...&type=recovery),
    // regardless of this client's flowType. This client is hardcoded to
    // "pkce" (see @supabase/ssr's createBrowserClient), and in PKCE mode
    // detectSessionInUrl only looks for a ?code= param — it never processes
    // an implicit-flow hash, so the PASSWORD_RECOVERY event never fires on
    // its own. The hash has to be parsed and exchanged for a session by hand.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        supabase.auth
          .setSession({ access_token, refresh_token })
          .then(({ error }) => {
            window.history.replaceState(null, "", window.location.pathname);
            if (error) {
              console.error("Recovery setSession failed:", error.message);
              router.replace("/login?error=recovery_failed");
            } else {
              router.replace("/update-password");
            }
          });
        setLoading(false);
        return;
      }
    }

    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
        });
        apiClient.setAccessToken(session.access_token);
      }
      setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        apiClient.setAccessToken(null);
      } else if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
        });
        apiClient.setAccessToken(session.access_token);
      }

      // Recovery links (implicit flow, #access_token=...&type=recovery) can
      // land on any page — the fragment survives client-side redirects.
      // The SDK auto-detects it and fires this event regardless of route,
      // so catching it here (app-wide) is the only reliable place to send
      // the user to the actual "set new password" screen.
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/update-password");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
