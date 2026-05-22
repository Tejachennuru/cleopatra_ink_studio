"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

export default function StudioLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const errorParam = params.get("error");
  const nextPath = params.get("next") ?? "";

  useEffect(() => {
    if (errorParam === "access_denied") setError("Your account has been deactivated. Contact the admin.");
    if (errorParam === "session_expired") setError("Your session has expired. Please sign in again.");
  }, [errorParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Fetch role to redirect appropriately
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staff } = await supabase
      .from("staff")
      .select("role, is_active")
      .eq("id", user!.id)
      .maybeSingle();

    if (!staff || !staff.is_active) {
      await supabase.auth.signOut();
      setError("Your account has been deactivated. Contact the admin.");
      setLoading(false);
      return;
    }

    // Stamp last_login — middleware uses this to enforce the 24hr timeout
    await supabase
      .from("staff")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user!.id);

    const dest = nextPath || (staff.role === "admin" ? "/studio/admin" : "/studio/designer");
    router.push(dest);
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025] hidden sm:block"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,#c9a84c 0px,#c9a84c 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#c9a84c 0px,#c9a84c 1px,transparent 1px,transparent 60px)",
        }}
      />
      {[
        "top-4 left-4 border-t-2 border-l-2 rounded-tl",
        "top-4 right-4 border-t-2 border-r-2 rounded-tr",
        "bottom-4 left-4 border-b-2 border-l-2 rounded-bl",
        "bottom-4 right-4 border-b-2 border-r-2 rounded-br",
      ].map((cls) => (
        <div key={cls} className={`absolute w-8 h-8 border-gold/25 ${cls}`} />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm z-10 flex flex-col gap-8"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 relative">
            <Image src="/cleopatra-logo.svg" alt="Cleopatra Ink Studio" fill className="object-contain" />
          </div>
          <div className="text-center">
            <h1 className="font-cinzel text-2xl font-black tracking-[0.12em] text-ink uppercase">Cleopatra</h1>
            <p className="font-cinzel text-xs font-bold tracking-[0.22em] text-gold uppercase">Ink Studio</p>
          </div>
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/30" />
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted uppercase">Staff Portal</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/30" />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">Email</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className="bg-surface border border-cleo-border rounded-xl px-4 py-3.5 text-ink text-base placeholder:text-muted/50 focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="bg-surface border border-cleo-border rounded-xl px-4 py-3.5 text-ink text-base placeholder:text-muted/50 focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-error text-sm font-mono"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            className="mt-2 w-full bg-gold text-bg font-cinzel font-bold text-base tracking-[0.1em] uppercase py-4 rounded-xl border border-gold hover:bg-gold-light transition-colors shadow-[0_0_24px_rgba(201,168,76,0.2)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Signing in…" : "Sign In →"}
          </motion.button>
        </form>

        <p className="text-center text-muted text-[10px] font-mono tracking-widest">
          CLEOPATRA INK STUDIO © 2026
        </p>
      </motion.div>
    </main>
  );
}
