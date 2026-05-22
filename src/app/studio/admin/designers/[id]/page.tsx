"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { StaffMember } from "@/lib/staff-types";

interface DesignRow {
  image_url: string;
  style_name: string | null;
  is_finalized: boolean;
}

interface SessionRow {
  id: string;
  tattoo_style: string | null;
  tattoo_description: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  users: { first_name: string; phone: string } | null;
  tattoo_designs: DesignRow[];
}

function TattooThumb({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  if (err) return <div className="w-full h-full flex items-center justify-center"><span className="text-muted/30 text-xl">✦</span></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Design" className="w-full h-full object-cover" onError={() => setErr(true)} />;
}

export default function DesignerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [designer, setDesigner] = useState<StaffMember | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/studio/login"); return; }

      const { data: selfStaff } = await supabase
        .from("staff").select("role").eq("id", user.id).maybeSingle();
      if (selfStaff?.role !== "admin") { router.push("/studio/designer"); return; }

      // Load designer info
      const { data: designerRow } = await supabase
        .from("staff")
        .select("id, email, name, role, is_active, created_at")
        .eq("id", id)
        .maybeSingle();

      if (!designerRow) { setNotFound(true); setLoading(false); return; }
      setDesigner(designerRow as StaffMember);

      // Load all sessions for this designer with finalized designs
      const { data: sessionRows } = await supabase
        .from("sessions")
        .select(`
          id, tattoo_style, tattoo_description, status, created_at, completed_at,
          users(first_name, phone),
          tattoo_designs(image_url, style_name, is_finalized)
        `)
        .eq("designer_id", id)
        .order("created_at", { ascending: false });

      setSessions((sessionRows ?? []) as unknown as SessionRow[]);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const statusColor = (s: string) =>
    s === "completed" ? "text-success" : s === "abandoned" ? "text-error" : "text-gold";

  if (loading) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <p className="font-cinzel text-xl text-ink">Designer not found.</p>
        <Link href="/studio/admin" className="text-gold underline font-mono text-sm">Back to admin</Link>
      </main>
    );
  }

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const activeSessions = sessions.filter((s) => s.status === "active");

  return (
    <main className="min-h-[100dvh] bg-bg flex flex-col">
      <header className="px-4 sm:px-6 pt-5 pb-4 border-b border-cleo-border flex items-center gap-3">
        <Link href="/studio/admin" className="text-muted hover:text-gold transition-colors text-xs font-mono tracking-wider flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
        <span className="text-cleo-border">/</span>
        <span className="text-muted text-xs font-mono truncate">{designer?.name}</span>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto w-full flex flex-col gap-7">

        {/* Designer profile */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="bg-surface border border-cleo-border rounded-2xl p-5 sm:p-6 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <span className="font-cinzel text-2xl font-black text-gold">{designer?.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-cinzel text-xl font-black text-ink">{designer?.name}</h1>
            <p className="text-muted text-sm font-mono">{designer?.email}</p>
            <p className="text-muted/60 text-xs font-mono tracking-widest uppercase mt-1">
              Designer · Joined {new Date(designer!.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-cinzel text-3xl font-black text-gold leading-none">{sessions.length}</p>
            <p className="text-muted text-[10px] font-mono uppercase tracking-widest mt-1">Total Sessions</p>
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Completed", value: completedSessions.length, color: "text-success" },
            { label: "In Progress", value: activeSessions.length, color: "text-gold" },
            { label: "Total Designs", value: sessions.reduce((n, s) => n + s.tattoo_designs.length, 0), color: "text-ink" },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface border border-cleo-border rounded-xl p-4 text-center">
              <p className={`font-cinzel text-2xl font-black leading-none ${stat.color}`}>{stat.value}</p>
              <p className="text-muted text-[10px] font-mono uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Sessions list */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-cinzel text-sm font-bold tracking-[0.18em] text-muted uppercase">All Sessions</h2>
            <div className="flex-1 h-px bg-cleo-border" />
          </div>

          {sessions.length === 0 ? (
            <div className="bg-surface border border-cleo-border rounded-2xl p-10 text-center">
              <p className="text-muted text-sm">No sessions yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((s, i) => {
                const customer = Array.isArray(s.users) ? s.users[0] : s.users;
                const designs = Array.isArray(s.tattoo_designs) ? s.tattoo_designs : [];
                const finalDesign = designs.find((d) => d.is_finalized) ?? designs[0];
                const dateLabel = new Date(s.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-surface border border-cleo-border rounded-2xl overflow-hidden hover:border-gold/30 transition-colors"
                  >
                    <div className="p-4 flex gap-4">
                      {/* Design thumbnail */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-2 border border-cleo-border flex-shrink-0">
                        {finalDesign?.image_url ? (
                          <TattooThumb url={finalDesign.image_url} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-2xl text-muted/20">✦</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-ink font-semibold truncate">{customer?.first_name ?? "Unknown"}</p>
                            <span className={`text-[10px] font-mono font-bold uppercase flex-shrink-0 ${statusColor(s.status)}`}>{s.status}</span>
                          </div>
                          {customer?.phone && (
                            <p className="text-muted text-xs font-mono">{customer.phone}</p>
                          )}
                          {s.tattoo_style && (
                            <p className="text-gold text-xs font-cinzel font-bold tracking-wider truncate">{s.tattoo_style}</p>
                          )}
                          {s.tattoo_description && (
                            <p className="text-muted text-xs line-clamp-1">{s.tattoo_description}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <p className="text-muted/50 text-[10px] font-mono">{dateLabel} · {designs.length} design{designs.length !== 1 ? "s" : ""}</p>
                          <Link
                            href={`/studio/admin/sessions/${s.id}?from=/studio/admin/designers/${id}`}
                            className="text-[10px] font-cinzel tracking-widest text-gold/60 hover:text-gold uppercase transition-colors"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Design thumbnails strip (if multiple) */}
                    {designs.length > 1 && (
                      <div className="border-t border-cleo-border px-4 py-3 flex gap-2 overflow-x-auto">
                        {designs.map((d, j) => (
                          <div key={j} className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border ${d.is_finalized ? "border-gold/50" : "border-cleo-border"}`}>
                            {d.image_url ? <TattooThumb url={d.image_url} /> : <div className="w-full h-full bg-surface-2" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
