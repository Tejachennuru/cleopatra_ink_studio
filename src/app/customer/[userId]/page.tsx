"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { useAppStore } from "@/store/app-store";
import { resolveBackUrl } from "@/lib/auth-utils";

const supabase = createSupabaseBrowserClient();

function TattooThumb({ url, alt }: { url: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-2xl text-muted/30">✦</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-full h-full object-cover" onError={() => setErrored(true)} />;
}

interface UserProfile {
  first_name: string;
  phone: string;
  created_at: string;
}

interface CompletedSession {
  id: string;
  tattoo_style: string | null;
  tattoo_description: string | null;
  completed_at: string;
  design: { image_url: string; style_name: string | null } | null;
  placement: { placement_text: string | null; final_composite_url: string | null } | null;
}

export default function CustomerDashboard() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startSessionForUser = useAppStore((s) => s.startSessionForUser);

  const fromParam = searchParams.get("from");
  // backUrl/backLabel are role-validated — set in useEffect after role is confirmed
  const [backUrl, setBackUrl] = useState("/studio/designer");
  const [backLabel, setBackLabel] = useState("Dashboard");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  useEffect(() => {
    async function load() {
      // Resolve and validate the back URL against the user's actual role
      const supabaseBrowser = createSupabaseBrowserClient();
      const { data: { user: authUser } } = await supabaseBrowser.auth.getUser();
      if (!authUser) { router.push("/studio/login"); return; }
      const { data: staffRow } = await supabaseBrowser
        .from("staff").select("role").eq("id", authUser.id).maybeSingle();
      const role = staffRow?.role as "admin" | "designer" | undefined ?? null;
      const defaultBack = role === "admin" ? "/studio/admin" : "/studio/designer";
      const defaultLabel = role === "admin" ? "Admin" : "Dashboard";
      const { backUrl: resolvedUrl, backLabel: resolvedLabel } =
        resolveBackUrl(fromParam, role, defaultBack, defaultLabel);
      setBackUrl(resolvedUrl);
      setBackLabel(resolvedLabel);

      const { data: user, error } = await supabase
        .from("users")
        .select("first_name, phone, created_at")
        .eq("id", userId)
        .maybeSingle();

      if (error || !user) { setNotFound(true); setLoading(false); return; }
      setProfile(user);

      const { data: rawSessions } = await supabase
        .from("sessions")
        .select(`
          id, tattoo_style, tattoo_description, completed_at,
          tattoo_designs!inner(image_url, style_name),
          placements(placement_text, final_composite_url)
        `)
        .eq("user_id", userId)
        .eq("status", "completed")
        .eq("tattoo_designs.is_finalized", true)
        .order("completed_at", { ascending: false });

      if (rawSessions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: CompletedSession[] = rawSessions.map((s: any) => ({
          id: s.id,
          tattoo_style: s.tattoo_style,
          tattoo_description: s.tattoo_description,
          completed_at: s.completed_at,
          design: Array.isArray(s.tattoo_designs) ? s.tattoo_designs[0] ?? null : s.tattoo_designs,
          placement: Array.isArray(s.placements)
            ? s.placements.find((p: any) => p.final_composite_url) ?? s.placements[0] ?? null
            : s.placements,
        }));
        setSessions(mapped);
      }

      setLoading(false);
    }
    load();
  }, [userId]);

  async function handleNewTattoo() {
    if (!profile) return;
    setStartingSession(true);
    const sessionId = await startSessionForUser(userId, profile.first_name, profile.phone);
    router.push(`/${sessionId}/design`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-muted font-mono text-sm tracking-widest">LOADING…</p>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 px-4">
        <p className="font-cinzel text-xl text-ink">Customer not found.</p>
        <Link href={backUrl} className="text-gold underline font-mono text-sm">← {backLabel}</Link>
      </main>
    );
  }

  const memberYear = profile ? new Date(profile.created_at).getFullYear() : "";

  return (
    <main className="min-h-[100dvh] bg-bg flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-cleo-border flex items-center justify-between gap-3">
        <button
          onClick={() => router.push(backUrl)}
          aria-label="Back"
          className="flex items-center gap-1.5 sm:gap-2 text-muted hover:text-gold transition-colors text-xs sm:text-sm font-mono tracking-wider flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{backLabel}</span>
        </button>

        <p className="font-cinzel text-[11px] sm:text-xs tracking-[0.2em] text-gold uppercase truncate">
          Cleopatra Ink
        </p>

        <motion.button
          onClick={handleNewTattoo}
          disabled={startingSession}
          whileHover={{ scale: startingSession ? 1 : 1.05 }}
          whileTap={{ scale: startingSession ? 1 : 0.95 }}
          className="bg-gold text-bg font-cinzel font-bold text-xs tracking-[0.08em] uppercase px-4 py-2 rounded-lg border border-gold hover:bg-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {startingSession ? "…" : "+ New Tattoo"}
        </motion.button>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 max-w-2xl mx-auto w-full">
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-surface border border-cleo-border rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-5"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <span className="font-cinzel text-xl sm:text-2xl font-black text-gold">
              {profile?.first_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
            <h1 className="font-cinzel text-base sm:text-xl font-black text-ink tracking-wide truncate">{profile?.first_name}</h1>
            <p className="text-muted text-xs sm:text-sm font-mono truncate">{profile?.phone}</p>
            <p className="text-muted/60 text-[10px] sm:text-xs font-mono tracking-widest">MEMBER SINCE {memberYear}</p>
          </div>
          <div className="ml-auto text-right flex-shrink-0">
            <p className="font-cinzel text-xl sm:text-2xl font-black text-gold leading-none">{sessions.length}</p>
            <p className="text-muted text-[10px] sm:text-xs tracking-widest uppercase font-mono mt-0.5">
              {sessions.length === 1 ? "Tattoo" : "Tattoos"}
            </p>
          </div>
        </motion.div>

        {/* Tattoo history */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-cinzel text-sm font-bold tracking-[0.18em] text-muted uppercase">Tattoo History</h2>
            <div className="flex-1 h-px bg-cleo-border" />
          </div>

          {sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-surface border border-cleo-border rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-gold/5 border border-gold/20 flex items-center justify-center">
                <span className="text-2xl text-gold/40">✦</span>
              </div>
              <p className="text-muted text-sm">No completed sessions yet.</p>
              <motion.button
                onClick={handleNewTattoo}
                disabled={startingSession}
                whileHover={{ scale: startingSession ? 1 : 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gold text-bg font-cinzel font-bold text-sm tracking-[0.08em] uppercase px-6 py-3 rounded-xl border border-gold hover:bg-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {startingSession ? "Starting…" : "Start Your First Design"}
              </motion.button>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-4">
              {sessions.map((session, i) => {
                const designUrl = session.design?.image_url;
                const bodyUrl = session.placement?.final_composite_url;
                const dateLabel = new Date(session.completed_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                });

                return (
                  <motion.button
                    key={session.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.07 }}
                    whileHover={{ y: -2 }}
                    onClick={() => router.push(`/studio/sessions/${session.id}?from=/customer/${userId}`)}
                    className="bg-surface border border-cleo-border rounded-2xl overflow-hidden text-left hover:border-gold/40 transition-colors cursor-pointer group"
                  >
                    <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                      {/* Thumbnail pair */}
                      <div className="flex gap-2 flex-shrink-0">
                        {[
                          { url: designUrl, label: "Design" },
                          { url: bodyUrl, label: "On Body" },
                        ].map(({ url, label }) => (
                          <div key={label} className="flex flex-col gap-1.5 items-center">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-2 border border-cleo-border group-hover:border-gold/30 transition-colors">
                              {url ? (
                                <TattooThumb url={url} alt={label} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xl text-muted/30">✦</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] font-mono tracking-[0.18em] text-muted uppercase">{label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Info */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 gap-2">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-cinzel text-xs font-bold tracking-[0.15em] text-gold uppercase truncate">
                              {session.tattoo_style ?? session.design?.style_name ?? "Custom Design"}
                            </span>
                            <span className="text-muted/50 text-[10px] font-mono flex-shrink-0">#{session.id}</span>
                          </div>
                          {session.tattoo_description && (
                            <p className="text-ink text-sm leading-snug line-clamp-2">{session.tattoo_description}</p>
                          )}
                          {session.placement?.placement_text && (
                            <p className="text-muted text-xs flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-gold/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {session.placement.placement_text}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-muted/50 text-xs font-mono">{dateLabel}</p>
                          <span className="text-[10px] font-cinzel tracking-widest text-muted/40 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                            View →
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky mobile CTA */}
      {sessions.length > 0 && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-cleo-border px-4 pt-3 pb-safe">
          <button
            onClick={handleNewTattoo}
            disabled={startingSession}
            className="w-full py-3.5 rounded-xl font-cinzel font-bold text-sm tracking-[0.08em] uppercase bg-gold text-bg border border-gold cursor-pointer shadow-[0_0_18px_rgba(201,168,76,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {startingSession ? "Starting…" : "✦ Start New Tattoo"}
          </button>
        </div>
      )}
    </main>
  );
}
