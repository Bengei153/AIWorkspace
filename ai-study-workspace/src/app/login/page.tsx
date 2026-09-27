"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Connect the Supabase project before signing in.");
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/` },
        });
        if (authError) throw authError;
        if (data.session) router.replace("/");
        else setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const requested = new URLSearchParams(window.location.search).get("next");
        const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
        router.replace(destination);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-900">
      <section className="w-full max-w-sm">
        <div className="mb-8"><p className="text-xs font-semibold uppercase text-indigo-700">Study Workspace</p><h1 className="mt-2 text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1><p className="mt-2 text-sm text-slate-500">Your courses and study files are private to your account.</p></div>
        <div className="mb-6 grid grid-cols-2 border-b border-slate-200"><button onClick={() => { setMode("login"); setError(""); setMessage(""); }} className={`border-b-2 py-2 text-sm font-medium ${mode === "login" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Sign in</button><button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className={`border-b-2 py-2 text-sm font-medium ${mode === "signup" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Create account</button></div>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" /></div>
          <div><label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" /><p className="mt-1 text-xs text-slate-500">At least 8 characters.</p></div>
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
      </section>
    </main>
  );
}
