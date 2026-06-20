import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  geminiKey: string | null;
  setGeminiKey: (key: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  session: null,
  user: null,
  loading: true,
  geminiKey: null,
  setGeminiKey: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Gemini key is stored in Supabase user_metadata so it persists across devices.
  const geminiKey: string | null =
    (session?.user?.user_metadata?.gemini_key as string | undefined) ?? null;

  const setGeminiKey = async (key: string | null) => {
    await supabase.auth.updateUser({ data: { gemini_key: key ?? "" } });
    // Refresh the session so the new metadata is reflected immediately.
    const { data } = await supabase.auth.refreshSession();
    if (data.session) setSession(data.session);
  };

  return (
    <AuthCtx.Provider value={{ session, user: session?.user ?? null, loading, geminiKey, setGeminiKey, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
