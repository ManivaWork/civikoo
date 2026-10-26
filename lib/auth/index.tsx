"use client";

import { createContext, useContext, useEffect, useState, ReactNode, ReactElement } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface GameProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  total_score: number;
  current_streak: number;
  longest_streak: number;
  title?: string;
  coins: number;
  equipped?: {
    cabeca?: string | null;
    corpo?: string | null;
    acessorio?: string | null;
    fundo?: string | null;
  };
}

interface SessionContextType {
  user: User | null;
  session: Session | null;
  profile: GameProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setProfile(data as GameProfile);
      }
    } catch (err) {
      console.warn("Failed to fetch game profile:", err);
    }
  };

  const refresh = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    setUser(user);
    setSession(session);
    if (user) {
      await fetchProfile(user.id);
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ user, session, profile, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}