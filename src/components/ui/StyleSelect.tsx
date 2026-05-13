"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const TATTOO_STYLES = [
  "Black & Grey",
  "Color Tattoo",
  "Realistic",
  "Hyper-realistic",
  "Old School",
  "New School",
  "Neo Traditional",
  "Anime",
  "Manga",
  "Minimal",
  "Fine Line",
  "Geometric",
  "Tribal",
  "Polynesian",
  "Japanese",
  "Gothic",
  "Dark Art",
  "Horror",
  "Biomechanical",
  "Lettering",
  "Script",
  "Chicano",
  "Portrait",
  "Mandala",
  "Ornamental",
  "Dotwork",
  "Watercolor",
  "Cover-up Design",
  "Sleeve Design",
  "Patchwork Design",
];

interface StyleSelectProps {
  value: string;
  onChange: (style: string) => void;
}

export default function StyleSelect({ value, onChange }: StyleSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = TATTOO_STYLES.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  function select(style: string) {
    onChange(style);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full bg-surface border rounded-xl px-4 py-3.5 text-left flex items-center justify-between transition-colors focus:outline-none ${
          open ? "border-gold" : "border-cleo-border hover:border-gold/40"
        }`}
      >
        <span className={value ? "text-ink text-sm font-cinzel font-bold" : "text-muted/60 text-sm"}>
          {value || "Select a tattoo style…"}
        </span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-muted flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ transformOrigin: "top" }}
            className="absolute z-50 top-full mt-1.5 w-full bg-surface border border-cleo-border rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            {/* Search */}
            <div className="p-2 border-b border-cleo-border">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search styles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-bg border border-cleo-border rounded-lg pl-8 pr-3 py-2 text-ink text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            {/* Options */}
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-muted text-sm font-cinzel">No styles found</div>
              ) : (
                filtered.map((style) => {
                  const isSelected = value === style;
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => select(style)}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors hover:bg-surface-2 ${
                        isSelected ? "text-gold font-bold font-cinzel" : "text-ink"
                      }`}
                    >
                      <span>{style}</span>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-gold flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
