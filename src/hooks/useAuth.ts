"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function ensureProfile(user: User) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) return data;

      const fullName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined;
      await supabase
        .from("profiles")
        .insert({ id: user.id, email: user.email, full_name: fullName });

      const { data: retry } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return retry;
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user);

      if (user) {
        const profile = await ensureProfile(user);
        if (mounted) setProfile(profile);
      }
      if (mounted) setLoading(false);
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfile(session.user).then((profile) => {
          if (mounted) setProfile(profile);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const role = profile?.role ?? null;
  const isAdmin = role === "admin";

  return { user, profile, role, isAdmin, loading };
}