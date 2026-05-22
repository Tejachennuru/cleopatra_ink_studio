"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { useAppStore } from "@/store/app-store";
import type { StaffMember } from "@/lib/staff-types";

interface CustomerResult {
  id: string;
  first_name: string;
  phone: string;
  session_count: number;
}

interface RecentSession {
  id: string;
  tattoo_style: string | null;
  status: string;
  created_at: string;
  users: { first_name: string; phone: string } | null;
}

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function DesignerDashboard() {
  const router = useRouter();
  const { setDesignerId, startSession, startSessionForUser } = useAppStore();

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [searchResult, setSearchResult] = useState<CustomerResult | null | "not_found">(null);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/studio/login"); return; }

      const { data: staffRow } = await supabase
        .from("staff")
        .select("id, email, name, role, is_active, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!staffRow) { router.push("/studio/login"); return; }
      setStaff(staffRow as StaffMember);
      setDesignerId(staffRow.id);

      // Load recent sessions for this designer
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, tattoo_style, status, created_at, users(first_name, phone)")
        .eq("designer_id", staffRow.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentSessions((sessions ?? []) as unknown as RecentSession[]);
      setLoadingRecent(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhoneSearch(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;

    setSearching(true);
    setSearchResult(null);
    setName("");

    const { data: customer } = await supabase
      .from("users")
      .select("id, first_name, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (!customer) {
      setSearchResult("not_found");
      setSearching(false);
      return;
    }

    // Count their sessions
    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customer.id)
      .eq("status", "completed");

    setSearchResult({ ...customer, session_count: count ?? 0 });
    setSearching(false);
  }

  async function handleStartExisting() {
    if (!searchResult || searchResult === "not_found") return;
    setStarting(true);
    const sessionId = await startSessionForUser(searchResult.id, searchResult.first_name, searchResult.phone);
    router.push(`/${sessionId}/design`);
  }

  async function handleCreateNew(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStarting(true);
    const { sessionId, userId } = await startSession(name.trim(), phone);

    if (userId && !sessionId) {
      // Existing user detected mid-flow — go to their dashboard
      router.push(`/customer/${userId}`);
    } else if (sessionId) {
      router.push(`/${sessionId}/design`);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setDesignerId(null);
    router.push("/studio/login");
    router.refresh();
  }

  function handleGoToCustomer() {
    if (searchResult && searchResult !== "not_found") {
      router.push(`/customer/${searchResult.id}?from=/studio/designer`);
    }
  }

  const statusColor = (s: string) =>
    s === "completed" ? "text-success" : s === "abandoned" ? "text-error" : "text-gold";

  return (
    <main className="min-h-[100dvh] bg-bg flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-5 pb-4 border-b border-cleo-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 relative flex-shrink-0">
            <Image src="/cleopatra-logo.svg" alt="Cleopatra" fill className="object-contain" />
          </div>
          <div>
            <p className="font-cinzel text-[11px] font-bold tracking-[0.15em] text-gold uppercase leading-none">
              Cleopatra Ink
            </p>
            <p className="text-[10px] font-mono text-muted tracking-wider leading-none mt-0.5">Designer Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {staff && (
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-ink text-sm font-semibold leading-none">{staff.name}</p>
              <p className="text-muted text-[10px] font-mono tracking-wider uppercase mt-0.5">Designer</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-muted hover:text-error transition-colors text-xs font-mono tracking-wider px-3 py-2 rounded-lg border border-cleo-border hover:border-error/40 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto w-full flex flex-col gap-7">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-gold text-[11px] font-mono tracking-[0.2em] uppercase mb-1">Welcome back</p>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-black text-ink">
            {staff?.name ?? "Designer"}
          </h1>
        </motion.div>

        {/* Customer Intake Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-surface border border-cleo-border rounded-2xl p-5 sm:p-6 flex flex-col gap-5"
        >
          <div>
            <h2 className="font-cinzel text-sm font-bold tracking-[0.15em] text-gold uppercase">Customer Lookup</h2>
            <p className="text-muted text-xs mt-1">Enter the customer&apos;s phone to find their account or create a new one.</p>
          </div>

          <form onSubmit={handlePhoneSearch} className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                setSearchResult(null);
                setName("");
              }}
              placeholder="(555) 000-0000"
              className="flex-1 bg-bg border border-cleo-border rounded-xl px-4 py-3 text-ink font-mono text-base placeholder:text-muted/40 focus:outline-none focus:border-gold transition-colors"
            />
            <button
              type="submit"
              disabled={searching || phone.replace(/\D/g, "").length < 10}
              className="px-5 py-3 bg-gold text-bg font-cinzel font-bold text-sm tracking-[0.08em] uppercase rounded-xl border border-gold hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {searching ? "…" : "Find"}
            </button>
          </form>

          <AnimatePresence mode="wait">
            {/* Existing customer found */}
            {searchResult && searchResult !== "not_found" && (
              <motion.div
                key="found"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3 pt-1 border-t border-cleo-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                    <span className="font-cinzel text-base font-black text-gold">
                      {searchResult.first_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-ink font-semibold">{searchResult.first_name}</p>
                    <p className="text-muted text-xs font-mono">
                      {searchResult.phone} · {searchResult.session_count} completed {searchResult.session_count === 1 ? "session" : "sessions"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleStartExisting}
                    disabled={starting}
                    className="flex-1 py-3 bg-gold text-bg font-cinzel font-bold text-sm tracking-[0.08em] uppercase rounded-xl border border-gold hover:bg-gold-light transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {starting ? "Starting…" : "✦ Start New Design"}
                  </button>
                  <button
                    onClick={handleGoToCustomer}
                    className="px-4 py-3 bg-transparent text-gold font-cinzel font-bold text-sm tracking-[0.08em] uppercase rounded-xl border border-gold/40 hover:border-gold hover:bg-gold/5 transition-colors cursor-pointer"
                  >
                    History
                  </button>
                </div>
              </motion.div>
            )}

            {/* Not found — show create form */}
            {searchResult === "not_found" && (
              <motion.form
                key="not_found"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onSubmit={handleCreateNew}
                className="flex flex-col gap-3 pt-1 border-t border-cleo-border"
              >
                <p className="text-muted text-xs">
                  No account found for this number. Enter the customer&apos;s name to create one.
                </p>
                <input
                  type="text"
                  placeholder="Customer full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="bg-bg border border-cleo-border rounded-xl px-4 py-3 text-ink text-base placeholder:text-muted/40 focus:outline-none focus:border-gold transition-colors"
                />
                <button
                  type="submit"
                  disabled={starting || !name.trim()}
                  className="py-3 bg-gold text-bg font-cinzel font-bold text-sm tracking-[0.08em] uppercase rounded-xl border border-gold hover:bg-gold-light transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {starting ? "Creating…" : "✦ Create Account & Start Design"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <h2 className="font-cinzel text-sm font-bold tracking-[0.18em] text-muted uppercase">Recent Sessions</h2>
            <div className="flex-1 h-px bg-cleo-border" />
            <span className="text-[10px] font-mono text-muted">Last 5</span>
          </div>

          {loadingRecent ? (
            <div className="flex items-center gap-2 py-6">
              <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-xs font-mono">Loading…</span>
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="bg-surface border border-cleo-border rounded-2xl p-8 text-center">
              <p className="text-muted text-sm">No sessions yet. Start your first design above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentSessions.map((s, i) => {
                const customer = Array.isArray(s.users) ? s.users[0] : s.users;
                return (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => router.push(`/studio/sessions/${s.id}`)}
                    className="bg-surface border border-cleo-border rounded-xl px-4 py-3 text-left hover:border-gold/40 transition-colors flex items-center gap-4 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="font-cinzel text-xs font-black text-gold">
                        {customer?.first_name?.charAt(0).toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink text-sm font-semibold truncate">{customer?.first_name ?? "Unknown"}</p>
                      <p className="text-muted text-xs font-mono truncate">{s.tattoo_style || "No style set"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-mono font-bold uppercase ${statusColor(s.status)}`}>{s.status}</p>
                      <p className="text-muted/60 text-[10px] font-mono">
                        {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-muted/30 group-hover:text-gold/60 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
