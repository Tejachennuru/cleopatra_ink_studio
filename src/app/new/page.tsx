"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";

export default function NewCustomerPage() {
  const router = useRouter();
  const startSession = useAppStore((s) => s.startSession);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!phone.replace(/\D/g, "")) errs.phone = "Phone number is required.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const id = startSession(name.trim(), phone);
    router.push(`/${id}/design`);
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-muted hover:text-gold transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 relative">
            <Image src="/cleopatra-logo.svg" alt="Cleopatra" fill className="object-contain" />
          </div>
          <span className="font-cinzel text-xs font-bold tracking-[0.15em] text-muted uppercase">
            Cleopatra Ink Studio
          </span>
        </div>
        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`rounded-full transition-all ${
                step === 1
                  ? "w-6 h-2 bg-gold"
                  : "w-2 h-2 bg-cleo-border"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <p className="text-gold text-xs font-mono tracking-[0.2em] uppercase mb-2">Step 1 of 3</p>
            <h1 className="font-cinzel text-3xl font-black text-ink">Customer Info</h1>
            <p className="text-muted text-sm mt-2">Enter the customer's details to begin their design session.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Full name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Aria Ramirez"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                autoFocus
                className={`bg-surface border rounded-xl px-5 py-4 text-ink text-base placeholder:text-muted/50 focus:outline-none transition-colors ${
                  errors.name ? "border-error" : "border-cleo-border focus:border-gold"
                }`}
              />
              {errors.name && <p className="text-error text-xs font-mono">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhone(e.target.value));
                  setErrors((p) => ({ ...p, phone: undefined }));
                }}
                className={`bg-surface border rounded-xl px-5 py-4 text-ink text-base placeholder:text-muted/50 focus:outline-none transition-colors font-mono ${
                  errors.phone ? "border-error" : "border-cleo-border focus:border-gold"
                }`}
              />
              {errors.phone && <p className="text-error text-xs font-mono">{errors.phone}</p>}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="mt-2 w-full bg-gold text-bg font-cinzel font-bold text-base tracking-[0.1em] uppercase py-4 rounded-xl border border-gold hover:bg-gold-light transition-colors cursor-pointer"
            >
              Continue to Design →
            </motion.button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
