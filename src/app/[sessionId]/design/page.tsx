"use client";

import { use, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "@/store/app-store";
import { generateMockDesigns } from "@/lib/placeholder-designs";
import type { DesignVariant } from "@/store/app-store";
import CameraCapture from "@/components/camera/CameraCapture";
import DesignPatternSVG from "@/components/design/DesignPatternSVG";
import StyleSelect from "@/components/ui/StyleSelect";

export default function DesignPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const {
    tattooStyle, setTattooStyle,
    tattooDescription, setTattooDescription,
    referenceImages, addReferenceImage, removeReferenceImage,
    generatedDesigns, generateDesigns, finishGenerating,
    selectedDesigns, toggleDesignSelection, clearDesignSelection,
    selectDesign,
    refinementText, setRefinementText,
    isGenerating, iterationCount,
    customerName,
  } = useAppStore();

  const [inputMode, setInputMode] = useState<"upload" | "camera">("upload");
  const [showCamera, setShowCamera] = useState(false);
  const designsRef = useRef<HTMLDivElement>(null);
  const refinementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerName) router.replace("/");
  }, [customerName, router]);

  useEffect(() => {
    if (!isGenerating && generatedDesigns.length > 0) {
      setTimeout(() => designsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [isGenerating, generatedDesigns.length]);

  useEffect(() => {
    if (selectedDesigns.length > 0 && refinementRef.current) {
      setTimeout(() => refinementRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }, [selectedDesigns.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: 5,
    onDrop: (files) => {
      files.forEach((f) => addReferenceImage(URL.createObjectURL(f)));
    },
  });

  const canGenerate = tattooDescription.trim().length > 0;
  const hasGenerated = generatedDesigns.length > 0;
  const hasSelection = selectedDesigns.length > 0;

  function handleGenerate() {
    if (!canGenerate) return;
    generateDesigns();
    setTimeout(() => {
      finishGenerating(generateMockDesigns(8));
    }, 3500);
  }

  function handleRefine() {
    if (!refinementText.trim() || selectedDesigns.length === 0) return;
    generateDesigns();
    setTimeout(() => {
      finishGenerating(generateMockDesigns(8));
    }, 3500);
  }

  function handleProceed() {
    // Use first selected design as the primary
    const primary = selectedDesigns[0];
    if (primary) {
      selectDesign(primary);
      router.push(`/${sessionId}/placement`);
    }
  }

  return (
    <>
      <AnimatePresence>
        {showCamera && (
          <CameraCapture
            onCapture={(url) => { addReferenceImage(url); setShowCamera(false); }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Heading */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-gold text-xs font-mono tracking-[0.2em] uppercase mb-1.5">Step 2 of 3 — Design</p>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-black text-ink">Describe your tattoo</h1>
          <p className="text-muted text-sm mt-2">Choose a style, describe your idea, and optionally add a reference image.</p>
        </motion.div>

        {/* ── Input card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-surface rounded-2xl border border-cleo-border p-5 sm:p-6 flex flex-col gap-5"
        >
          {/* Style picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
              Tattoo Style <span className="text-muted/50 normal-case">(optional but recommended)</span>
            </label>
            <StyleSelect value={tattooStyle} onChange={setTattooStyle} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">Describe your tattoo</label>
            <textarea
              rows={4}
              placeholder={
                tattooStyle
                  ? `Describe your ${tattooStyle} tattoo… e.g. A fierce lion face with a detailed mane, surrounded by geometric shapes and fine line roses…`
                  : "e.g. A detailed mandala with lotus petals, geometric outer rings, and a crescent moon at the top. Fine lines, sacred geometry feel…"
              }
              value={tattooDescription}
              onChange={(e) => setTattooDescription(e.target.value)}
              className="bg-bg border border-cleo-border rounded-xl px-4 py-3.5 text-ink text-sm placeholder:text-muted/50 focus:border-gold focus:outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Reference images */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
                  Reference Images <span className="text-muted/40 normal-case">(optional)</span>
                </label>
                {referenceImages.length > 0 && (
                  <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
                    {referenceImages.length}/5
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-bg rounded-lg border border-cleo-border p-0.5">
                {(["upload", "camera"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={`px-3 py-1 rounded-md text-xs font-cinzel tracking-wide transition-all ${inputMode === mode ? "bg-gold text-bg font-bold" : "text-muted hover:text-ink"}`}
                  >
                    {mode === "upload" ? "📁 Upload" : "📷 Camera"}
                  </button>
                ))}
              </div>
            </div>

            {/* Uploaded thumbnails grid */}
            <AnimatePresence>
              {referenceImages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="grid grid-cols-3 sm:grid-cols-5 gap-2"
                >
                  {referenceImages.map((url, i) => (
                    <motion.div
                      key={url}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.2 }}
                      className="relative group rounded-xl overflow-hidden border border-cleo-border bg-surface-2"
                      style={{ aspectRatio: "1" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeReferenceImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-error text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white/70 text-[9px] font-mono px-1.5 py-0.5 rounded">
                        {i + 1}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add more / first upload */}
            <AnimatePresence mode="wait">
              {referenceImages.length < 5 && inputMode === "upload" && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div
                    {...getRootProps()}
                    className={`rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                      isDragActive ? "border-gold bg-gold/5" : "border-cleo-border hover:border-gold/40"
                    } ${referenceImages.length > 0 ? "py-4" : "py-7"}`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-gold text-lg flex-shrink-0">+</div>
                      {referenceImages.length === 0 ? (
                        <div>
                          <p className="text-ink text-sm font-cinzel">Drop images or click to browse</p>
                          <p className="text-muted text-xs">Up to 5 photos — JPEG, PNG, WEBP, HEIC</p>
                        </div>
                      ) : (
                        <p className="text-muted text-sm font-cinzel">
                          Add more photos ({5 - referenceImages.length} remaining)
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              {referenceImages.length < 5 && inputMode === "camera" && (
                <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={() => setShowCamera(true)}
                    className={`w-full rounded-xl border-2 border-dashed border-cleo-border hover:border-gold/40 transition-all ${referenceImages.length > 0 ? "py-4" : "py-7"}`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xl flex-shrink-0">📷</div>
                      {referenceImages.length === 0 ? (
                        <div className="text-left">
                          <p className="text-ink text-sm font-cinzel">Open Camera</p>
                          <p className="text-muted text-xs">Take a live reference photo</p>
                        </div>
                      ) : (
                        <p className="text-muted text-sm font-cinzel">
                          Take another photo ({5 - referenceImages.length} remaining)
                        </p>
                      )}
                    </div>
                  </button>
                </motion.div>
              )}
              {referenceImages.length >= 5 && (
                <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
                  <p className="text-muted text-xs font-mono">Maximum 5 reference images reached</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generate button */}
          <motion.button
            whileHover={canGenerate && !isGenerating ? { scale: 1.02 } : {}}
            whileTap={canGenerate && !isGenerating ? { scale: 0.97 } : {}}
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className={`w-full py-4 rounded-xl font-cinzel font-bold text-base tracking-[0.08em] uppercase transition-all border ${
              canGenerate && !isGenerating
                ? "bg-gold text-bg border-gold hover:bg-gold-light cursor-pointer"
                : "bg-surface-2 text-muted border-cleo-border cursor-not-allowed"
            }`}
          >
            {isGenerating
              ? "Generating…"
              : hasGenerated
              ? `✦ Regenerate from Scratch`
              : "✦ Generate Tattoo Designs"}
          </motion.button>
        </motion.div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 py-10"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-gold/15 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-gold/30 animate-spin" style={{ animationDuration: "2s" }} />
                <div className="absolute inset-4 rounded-full border-2 border-gold animate-spin" style={{ animationDuration: "1.2s", animationDirection: "reverse" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-cinzel text-lg font-bold text-ink">
                  {iterationCount > 1 ? `Refining — Pass ${iterationCount}…` : "Crafting Your Designs…"}
                </p>
                <p className="text-muted text-sm mt-1">
                  {tattooStyle ? `Generating 8 ${tattooStyle} variations` : "Generating 8 unique variations"}
                </p>
              </div>
              <div className="w-56 h-1 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gold rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3.3, ease: "easeInOut" }}
                />
              </div>
              <div className="grid grid-cols-4 gap-3 w-full max-w-lg">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-cleo-border">
                    <div className="aspect-square skeleton" />
                    <div className="p-2 bg-surface"><div className="h-2 skeleton rounded w-12" /></div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Design grid ─────────────────────────────────────────── */}
        <AnimatePresence>
          {!isGenerating && hasGenerated && (
            <motion.div
              key={`designs-${iterationCount}`}
              ref={designsRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-5"
            >
              {/* Header row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-cinzel text-xl font-bold text-ink">
                    {iterationCount > 1 ? `Refined Designs — Pass ${iterationCount}` : "Your Designs"}
                  </h2>
                  <p className="text-muted text-xs mt-0.5">
                    {hasSelection
                      ? `${selectedDesigns.length} selected — describe what to keep, then refine or proceed`
                      : "Select one or more designs you like to compare and refine"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasSelection && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => clearDesignSelection()}
                      className="text-muted text-xs font-cinzel tracking-wide hover:text-gold transition-colors px-2 py-1 rounded border border-cleo-border hover:border-gold/40"
                    >
                      Clear selection
                    </motion.button>
                  )}
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
                    hasSelection
                      ? "text-gold border-gold/40 bg-gold/10"
                      : "text-muted border-cleo-border"
                  }`}>
                    {hasSelection ? `${selectedDesigns.length} / 4 selected` : "8 variations"}
                  </span>
                </div>
              </div>

              {/* 4-column grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {generatedDesigns.map((design, i) => {
                  const selectionIndex = selectedDesigns.findIndex((d) => d.id === design.id);
                  const isSelected = selectionIndex !== -1;
                  const selectionOrder = selectionIndex + 1;
                  const canSelect = !isSelected && selectedDesigns.length < 4;

                  return (
                    <motion.button
                      key={design.id}
                      initial={{ opacity: 0, scale: 0.88, y: 14 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.38, delay: i * 0.055, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ scale: 1.03, y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleDesignSelection(design)}
                      disabled={!canSelect && !isSelected}
                      className={[
                        "relative rounded-2xl overflow-hidden text-left border-2 transition-all duration-250 cursor-pointer",
                        isSelected
                          ? "border-gold shadow-[0_0_20px_rgba(201,168,76,0.45)]"
                          : canSelect
                          ? "border-cleo-border hover:border-gold/40"
                          : "border-cleo-border opacity-50 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {/* Artwork */}
                      <div className="aspect-square relative" style={{ background: design.gradient }}>
                        <DesignPatternSVG type={design.patternType} />

                        {/* Selection badge */}
                        {isSelected ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gold shadow-lg flex items-center justify-center"
                          >
                            <span className="text-bg text-xs font-black font-mono">{selectionOrder}</span>
                          </motion.div>
                        ) : (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white/30 bg-black/30 backdrop-blur-sm" />
                        )}

                        {/* Design number */}
                        <div className="absolute top-2 left-2">
                          <span className="bg-black/60 backdrop-blur-sm text-ink/70 text-[9px] font-mono px-1.5 py-0.5 rounded">
                            #{i + 1}
                          </span>
                        </div>

                        {/* Selected glow overlay */}
                        {isSelected && (
                          <div className="absolute inset-0 ring-2 ring-inset ring-gold/30 rounded-t-2xl pointer-events-none" />
                        )}
                      </div>

                      <div className={`px-3 py-2.5 transition-colors ${isSelected ? "bg-gold/10" : "bg-surface"}`}>
                        <p className={`text-xs font-cinzel font-bold leading-tight ${isSelected ? "text-gold" : "text-ink"}`}>
                          {design.styleName}
                        </p>
                        <p className="text-muted text-[10px] mt-0.5">
                          {isSelected ? `Selected #${selectionOrder}` : "Tap to select"}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Refinement + Proceed panel ──────────────────────────── */}
        <AnimatePresence>
          {hasSelection && !isGenerating && (
            <motion.div
              key="refinement"
              ref={refinementRef}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35 }}
              className="bg-surface rounded-2xl border border-gold/30 overflow-hidden"
            >
              {/* Selected designs row */}
              <div className="px-5 pt-5 pb-4 border-b border-cleo-border/60">
                <p className="text-gold text-xs font-mono tracking-[0.15em] uppercase mb-3">
                  You selected {selectedDesigns.length} design{selectedDesigns.length > 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {selectedDesigns.map((d, i) => {
                    const globalIndex = generatedDesigns.findIndex((gd) => gd.id === d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-2 bg-bg rounded-xl border border-gold/20 p-2 pr-3">
                        <div className="relative">
                          <div
                            className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative"
                            style={{ background: d.gradient }}
                          >
                            <DesignPatternSVG type={d.patternType} />
                          </div>
                          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                            <span className="text-bg text-[9px] font-black">{i + 1}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-ink text-xs font-cinzel font-bold leading-tight">{d.styleName}</p>
                          <p className="text-muted text-[9px]">Design #{globalIndex + 1}</p>
                        </div>
                        <button
                          onClick={() => toggleDesignSelection(d)}
                          className="ml-1 text-muted hover:text-error transition-colors text-sm leading-none"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Refinement input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
                    What do you like? What to change?
                  </label>
                  <textarea
                    rows={3}
                    placeholder={
                      selectedDesigns.length > 1
                        ? `e.g. I love the bold linework from Design #${generatedDesigns.findIndex((d) => d.id === selectedDesigns[0]?.id) + 1} and the intricate detail from Design #${generatedDesigns.findIndex((d) => d.id === selectedDesigns[1]?.id) + 1}. Combine both — keep the style but make the shading darker…`
                        : "Describe what you love and what you'd change… e.g. Keep the mandala structure but make the outer rings more intricate, add a crescent moon at the top…"
                    }
                    value={refinementText}
                    onChange={(e) => setRefinementText(e.target.value)}
                    className="bg-bg border border-cleo-border rounded-xl px-4 py-3 text-ink text-sm placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Refine button */}
                  <motion.button
                    whileHover={refinementText.trim() ? { scale: 1.02 } : {}}
                    whileTap={refinementText.trim() ? { scale: 0.97 } : {}}
                    onClick={handleRefine}
                    disabled={!refinementText.trim()}
                    className={`flex-1 py-3.5 rounded-xl font-cinzel font-bold text-sm tracking-wide uppercase border transition-all ${
                      refinementText.trim()
                        ? "bg-surface-2 border-gold/40 text-gold hover:bg-gold/10 cursor-pointer"
                        : "bg-surface-2 border-cleo-border text-muted cursor-not-allowed"
                    }`}
                  >
                    ↺ Refine &amp; Generate Again
                  </motion.button>

                  {/* Proceed button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleProceed}
                    className="flex-1 bg-gold text-bg font-cinzel font-bold text-base tracking-[0.08em] uppercase py-3.5 rounded-xl border border-gold hover:bg-gold-light transition-colors cursor-pointer shadow-[0_0_20px_rgba(201,168,76,0.2)]"
                  >
                    {selectedDesigns.length === 1
                      ? "✦ Proceed to Placement →"
                      : `✦ Proceed with Design #${generatedDesigns.findIndex((d) => d.id === selectedDesigns[0]?.id) + 1} →`}
                  </motion.button>
                </div>

                {selectedDesigns.length > 1 && (
                  <p className="text-muted text-[10px] font-mono text-center">
                    Proceeding with your first selection as the primary design
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
