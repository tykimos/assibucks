'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// Global cache to persist auth state across component re-mounts
let cachedUser: User | null = null;
let isInitialized = false;
const listeners = new Set<(user: User | null) => void>();

function notifyListeners(user: User | null) {
  cachedUser = user;
  listeners.forEach(listener => listener(user));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!isInitialized);

  useEffect(() => {
    const supabase = createClient();

    // Register listener
    listeners.add(setUser);

    // Only fetch if not initialized
    if (!isInitialized) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        isInitialized = true;
        notifyListeners(user);
        setLoading(false);
      });
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      notifyListeners(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      listeners.delete(setUser);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithKakao = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    isInitialized = false;
    cachedUser = null;
  }, []);

  return {
    user,
    loading,
    signInWithKakao,
    signOut,
  };
}
