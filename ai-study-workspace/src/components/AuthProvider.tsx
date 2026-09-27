"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { applyRemoteWorkspace, clearActiveWorkspace, flushWorkspaceSync, initializeWorkspace, type WorkspaceSnapshot } from "@/lib/workspace";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  authLoading: boolean;
  workspaceReady: boolean;
  workspaceError: string;
  workspaceRevision: number;
  retryWorkspace: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({ user: null, authLoading: true, workspaceReady: false, workspaceError: "", workspaceRevision: 0, retryWorkspace: () => undefined, signOut: async () => undefined });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const supabase = createClient();
    let mounted = true;
    let trackedUserId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const onWorkspaceChanged = () => setWorkspaceRevision((revision) => revision + 1);
    window.addEventListener("workspace:changed", onWorkspaceChanged);
    const synchronize = (nextUser: User | null) => {
      if (!mounted) return Promise.resolve();
      if (!nextUser) {
        trackedUserId = null;
        clearActiveWorkspace();
        setUser(null);
        setWorkspaceReady(false);
        setWorkspaceError("");
        setAuthLoading(false);
        return Promise.resolve();
      }
      setUser(nextUser);
      if (trackedUserId === nextUser.id) return Promise.resolve();
      trackedUserId = nextUser.id;
      setAuthLoading(true);
      setWorkspaceReady(false);
      return initializeWorkspace(nextUser.id).then(() => {
        if (!mounted) return;
        setWorkspaceReady(true);
        setWorkspaceError("");
        if (channel) void supabase.removeChannel(channel);
        channel = supabase.channel(`private-workspace-${nextUser.id}`).on("postgres_changes", {
          event: "*", schema: "public", table: "user_workspaces", filter: `user_id=eq.${nextUser.id}`,
        }, (payload) => {
          const row = payload.new as { user_id?: string; data?: WorkspaceSnapshot };
          if (row.user_id === nextUser.id && row.data) applyRemoteWorkspace(nextUser.id, row.data);
        }).subscribe();
      }).catch((error: unknown) => {
        if (!mounted) return;
        trackedUserId = null;
        setWorkspaceError(error instanceof Error ? error.message : "Could not load your private workspace.");
      }).finally(() => {
        if (mounted) setAuthLoading(false);
      });
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) throw error;
      return synchronize(data.user);
    }).catch((error: unknown) => {
      if (mounted) {
        setWorkspaceError(error instanceof Error ? error.message : "Could not verify your sign-in.");
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void synchronize(session?.user ?? null); });
    });
    return () => {
      mounted = false;
      window.removeEventListener("workspace:changed", onWorkspaceChanged);
      if (channel) void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [retry]);

  async function signOut() {
    await flushWorkspaceSync();
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
    clearActiveWorkspace();
    router.replace("/login");
  }

  const value: AuthContextValue = {
    user, authLoading, workspaceReady, workspaceError, workspaceRevision,
    retryWorkspace: () => setRetry((value) => value + 1),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}{workspaceError && <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-between gap-3 border-t border-red-200 bg-white px-5 py-3 text-sm text-red-800 shadow-lg"><span>{workspaceError}</span><button onClick={() => setRetry((value) => value + 1)} className="font-medium underline">Retry connection</button></div>}</AuthContext.Provider>;
}
