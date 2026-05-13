"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";

export default function Dashboard() {
  const reset = useAppStore((s) => s.reset);

  // Reset any in-progress session when landing back here
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #c9a84c 0px, #c9a84c 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #c9a84c 0px, #c9a84c 1px, transparent 1px, transparent 60px)",
        }}
      />

      {/* Corner ornaments */}
      {[
        "top-6 left-6 border-t-2 border-l-2 rounded-tl",
        "top-6 right-6 border-t-2 border-r-2 rounded-tr",
        "bottom-6 left-6 border-b-2 border-l-2 rounded-bl",
        "bottom-6 right-6 border-b-2 border-r-2 rounded-br",
      ].map((cls) => (
        <div key={cls} className={`absolute w-10 h-10 border-gold/25 ${cls}`} />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-10 z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-28 h-28 relative drop-shadow-2xl"
        >
          <Image
            src="/cleopatra-logo.svg"
            alt="Cleopatra Ink Studio"
            fill
            className="object-contain"
            priority
          />
        </motion.div>

        {/* Title */}
        <div className="text-center flex flex-col gap-1">
          <h1 className="font-cinzel text-4xl font-black tracking-[0.12em] text-ink uppercase leading-none">
            Cleopatra
          </h1>
          <h2 className="font-cinzel text-xl font-bold tracking-[0.22em] text-gold uppercase">
            Ink Studio
          </h2>
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/40" />
            <div className="w-1 h-1 rounded-full bg-gold rotate-45" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <p className="text-muted text-xs tracking-[0.18em] uppercase font-cinzel">
            AI-Powered Tattoo Design
          </p>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="w-full"
        >
          <Link href="/new" className="block w-full">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="w-full bg-gold text-bg font-cinzel font-bold text-lg tracking-[0.1em] uppercase py-5 rounded-xl border border-gold hover:bg-gold-light transition-colors shadow-[0_0_32px_rgba(201,168,76,0.25)] cursor-pointer"
            >
              ✦ New Customer
            </motion.button>
          </Link>
        </motion.div>

        <p className="text-muted text-[11px] font-mono tracking-widest">
          CLEOPATRA INK STUDIO © 2026
        </p>
      </motion.div>
    </main>
  );
}
