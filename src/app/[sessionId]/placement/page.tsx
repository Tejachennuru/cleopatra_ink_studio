"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "@/store/app-store";
import DesignPatternSVG from "@/components/design/DesignPatternSVG";
import CameraCapture from "@/components/camera/CameraCapture";

export default function PlacementPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const {
    selectedDesign, customerName,
    placementText, setPlacementText,
    bodyPhoto, setBodyPhoto,
    finalComposite, generatePlacement, finishPlacement,
    isGeneratingPlacement,
  } = useAppStore();

  const [inputMode, setInputMode] = useState<"text" | "upload" | "camera">("text");
  const [showCamera, setShowCamera] = useState(false);
  const [done, setDone] = useState(false);

  // Redirect if no design selected
  useEffect(() => {
    if (!customerName) router.replace("/");
    if (!selectedDesign) router.replace(`/${sessionId}/design`);
  }, [customerName, selectedDesign, sessionId, router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: 1,
    onDrop: (files) => {
      const f = files[0];
      if (f) setBodyPhoto(URL.createObjectURL(f));
    },
  });

  const canGenerate =
    (inputMode === "text" && placementText.trim().length > 0) ||
    (inputMode !== "text" && !!bodyPhoto);

  function handleGenerate() {
    if (!canGenerate) return;
    generatePlacement();
    setTimeout(() => {
      // Use a placeholder composite: body photo if available, otherwise silhouette
      finishPlacement(bodyPhoto ?? "__silhouette__");
    }, 3800);
  }

  if (done) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-8 text-center max-w-sm"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 180 }}
            className="relative"
          >
            <div className="w-24 h-24 rounded-full bg-gold shadow-[0_0_40px_rgba(201,168,76,0.6)] flex items-center justify-center">
              <svg className="w-12 h-12 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-gold/30 animate-ping" />
          </motion.div>

          <div>
            <h1 className="font-cinzel text-3xl font-black text-ink">Session Complete!</h1>
            <p className="text-muted text-sm mt-3 leading-relaxed">
              {customerName}&apos;s design has been finalized and sent to the artist.
            </p>
          </div>

          <div className="bg-surface border border-cleo-border rounded-2xl p-5 w-full text-left flex flex-col gap-3">
            <p className="text-muted text-[10px] font-mono uppercase tracking-widest">Summary</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative border border-gold/30"
                style={{ background: selectedDesign?.gradient }}>
                {selectedDesign && <DesignPatternSVG type={selectedDesign.patternType} />}
              </div>
              <div>
                <p className="text-ink text-sm font-cinzel font-bold">{selectedDesign?.styleName}</p>
                <p className="text-muted text-xs">Placement: {placementText || "Body photo provided"}</p>
              </div>
            </div>
            <div className="h-px bg-cleo-border" />
            <div className="flex justify-between">
              <span className="text-muted text-xs font-mono">Customer</span>
              <span className="text-ink text-xs font-cinzel font-bold">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-xs font-mono">Session ID</span>
              <span className="text-gold text-xs font-mono font-bold">{sessionId}</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/")}
            className="w-full bg-gold text-bg font-cinzel font-bold text-base tracking-[0.08em] uppercase py-4 rounded-xl border border-gold hover:bg-gold-light transition-colors cursor-pointer"
          >
            ✦ New Customer
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showCamera && (
          <CameraCapture
            onCapture={(url) => { setBodyPhoto(url); setShowCamera(false); }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Heading */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-gold text-xs font-mono tracking-[0.2em] uppercase mb-1.5">Step 3 of 3 — Placement</p>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-black text-ink">Where does it go?</h1>
          <p className="text-muted text-sm mt-2">
            Tell us or show us where on the body you&apos;d like the tattoo placed.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Selected design */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex flex-col gap-4"
          >
            <p className="text-muted text-xs font-mono uppercase tracking-widest">Selected Design</p>
            <div
              className="rounded-2xl overflow-hidden border border-gold/30 aspect-square relative"
              style={{ background: selectedDesign?.gradient }}
            >
              {selectedDesign && <DesignPatternSVG type={selectedDesign.patternType} />}
              <div className="absolute bottom-3 left-3">
                <span className="bg-black/70 backdrop-blur-sm text-gold text-xs font-cinzel font-bold px-3 py-1 rounded-lg border border-gold/20">
                  {selectedDesign?.styleName}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Right: Placement input */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col gap-5"
          >
            {/* Mode tabs */}
            <div className="flex items-center gap-1 bg-surface rounded-xl border border-cleo-border p-1">
              {(["text", "upload", "camera"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setBodyPhoto(null); }}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-cinzel tracking-wide transition-all ${
                    inputMode === mode ? "bg-gold text-bg font-bold" : "text-muted hover:text-ink"
                  }`}
                >
                  {mode === "text" ? "📝 Describe" : mode === "upload" ? "📁 Upload" : "📷 Camera"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {inputMode === "text" && (
                <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                  <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">Describe placement</label>
                  <textarea
                    rows={5}
                    placeholder="e.g. Upper right arm, outer bicep area, about 4 inches wide. The design should wrap slightly around the arm following the muscle contour..."
                    value={placementText}
                    onChange={(e) => setPlacementText(e.target.value)}
                    className="bg-surface border border-cleo-border rounded-xl px-4 py-3.5 text-ink text-sm placeholder:text-muted/50 focus:border-gold focus:outline-none transition-colors resize-none leading-relaxed"
                  />
                </motion.div>
              )}

              {inputMode === "upload" && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {bodyPhoto ? (
                    <div className="relative group rounded-xl overflow-hidden border border-cleo-border" style={{ aspectRatio: "4/3" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bodyPhoto} alt="Body" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setBodyPhoto(null)}
                        className="absolute top-2 right-2 bg-error text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                      <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white/70 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                        Body photo added
                      </div>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                        isDragActive ? "border-gold bg-gold/5" : "border-cleo-border hover:border-gold/40"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-2xl">+</div>
                        <p className="text-ink text-sm font-cinzel">Upload body photo</p>
                        <p className="text-muted text-xs">Photo of the area where the tattoo will be placed</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {inputMode === "camera" && (
                <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {bodyPhoto ? (
                    <div className="relative group rounded-xl overflow-hidden border border-cleo-border" style={{ aspectRatio: "4/3" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bodyPhoto} alt="Body" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setBodyPhoto(null)}
                        className="absolute top-2 right-2 bg-error text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCamera(true)}
                      className="w-full rounded-xl border-2 border-dashed border-cleo-border hover:border-gold/40 p-10 text-center transition-all"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-2xl">📷</div>
                        <p className="text-ink text-sm font-cinzel">Open Camera</p>
                        <p className="text-muted text-xs">Point at the placement area on the body</p>
                      </div>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={canGenerate ? { scale: 1.02 } : {}}
              whileTap={canGenerate ? { scale: 0.97 } : {}}
              onClick={handleGenerate}
              disabled={!canGenerate || isGeneratingPlacement}
              className={`w-full py-4 rounded-xl font-cinzel font-bold text-base tracking-[0.08em] uppercase border transition-all ${
                canGenerate && !isGeneratingPlacement
                  ? "bg-gold text-bg border-gold hover:bg-gold-light cursor-pointer shadow-[0_0_20px_rgba(201,168,76,0.2)]"
                  : "bg-surface-2 text-muted border-cleo-border cursor-not-allowed"
              }`}
            >
              {isGeneratingPlacement ? "Generating Preview…" : "✦ Generate Placement Preview"}
            </motion.button>
          </motion.div>
        </div>

        {/* Generation loading */}
        <AnimatePresence>
          {isGeneratingPlacement && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 py-10"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-gold/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-gold/40 animate-spin" style={{ animationDuration: "2s" }} />
                <div className="absolute inset-4 rounded-full border-2 border-gold animate-spin" style={{ animationDuration: "1.4s", animationDirection: "reverse" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-cinzel text-lg font-bold text-ink">Compositing Your Design…</p>
                <p className="text-muted text-sm mt-1">Placing the tattoo on the body preview</p>
              </div>
              <div className="w-56 h-1 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gold rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3.6, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final composite result */}
        <AnimatePresence>
          {!isGeneratingPlacement && finalComposite && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-cinzel text-xl font-bold text-ink">Placement Preview</h2>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-success text-xs font-mono">Generated</span>
                </div>
              </div>

              {/* Composite preview */}
              <div className="rounded-2xl overflow-hidden border border-cleo-border relative" style={{ aspectRatio: "4/3", maxHeight: "480px" }}>
                {/* Body background */}
                {finalComposite !== "__silhouette__" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={finalComposite} alt="Body" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
                    <svg viewBox="0 0 120 260" className="h-4/5 opacity-15" fill="var(--cleo-text)">
                      <ellipse cx="60" cy="28" rx="18" ry="20" />
                      <rect x="36" y="52" width="48" height="80" rx="8" />
                      <rect x="12" y="55" width="22" height="68" rx="8" />
                      <rect x="86" y="55" width="22" height="68" rx="8" />
                      <rect x="38" y="132" width="20" height="90" rx="8" />
                      <rect x="62" y="132" width="20" height="90" rx="8" />
                    </svg>
                  </div>
                )}

                {/* Tattoo overlay — centered/positioned on body */}
                <div
                  className="absolute rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.7)]"
                  style={{
                    width: "180px",
                    height: "180px",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -55%)",
                    background: selectedDesign?.gradient,
                    opacity: 0.88,
                  }}
                >
                  {selectedDesign && <DesignPatternSVG type={selectedDesign.patternType} />}
                  {/* Skin blend overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20 rounded-xl" />
                </div>

                {/* Placement label */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div className="bg-black/70 backdrop-blur-sm text-ink/90 text-xs font-cinzel px-3 py-1.5 rounded-lg">
                    {placementText || "Body placement preview"}
                  </div>
                  <div className="bg-black/70 backdrop-blur-sm text-gold text-[10px] font-mono px-2 py-1 rounded-lg border border-gold/20">
                    AI Preview
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { finishPlacement(""); }}
                  className="flex-1 py-3 rounded-xl font-cinzel text-sm tracking-wide border border-cleo-border text-muted hover:text-ink hover:border-gold/40 transition-all cursor-pointer"
                >
                  ↺ Try Different Placement
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setDone(true)}
                  className="flex-1 bg-gold text-bg font-cinzel font-bold text-base tracking-[0.08em] uppercase py-4 rounded-xl border border-gold hover:bg-gold-light transition-colors cursor-pointer shadow-[0_0_24px_rgba(201,168,76,0.3)]"
                >
                  ✦ Looks Perfect — Finalize
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
