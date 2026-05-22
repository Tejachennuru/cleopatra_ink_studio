"use client";

import { use, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "@/store/app-store";
import type { DesignVariant } from "@/store/app-store";
import CameraCapture from "@/components/camera/CameraCapture";
import DesignPatternSVG from "@/components/design/DesignPatternSVG";
import StyleSelect from "@/components/ui/StyleSelect";
import PinterestSearch from "@/components/pinterest/PinterestSearch";
import { blobUrlToBase64 } from "@/lib/image-utils";
import { TATTOO_COLORS } from "@/lib/tattoo-colors";

export default function DesignPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const {
    tattooStyle, setTattooStyle,
    tattooDescription, setTattooDescription,
    referenceImages, addReferenceImage, removeReferenceImage, replaceReferenceImage,
    selectedColors, toggleColor, clearColors,
    generatedDesigns, generateDesigns, finishGenerating,
    selectedDesigns, toggleDesignSelection, clearDesignSelection,
    selectDesign,
    refinementText, setRefinementText,
    isGenerating, iterationCount,
    customerName,
    persistDesigns,
    hydrateFromSession,
  } = useAppStore();

  const [hydrating, setHydrating] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed seconds while a generation is in flight — used for the
  // progress UI so the user has an honest sense of wait time.
  useEffect(() => {
    if (!isGenerating) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isGenerating]);

  const STAGE_MESSAGES = [
    "Reading your brief…",
    "Sketching variations in your style…",
    "Refining linework and shading…",
    "Polishing final details…",
  ];
  const stageIdx = Math.min(STAGE_MESSAGES.length - 1, Math.floor(elapsed / 25));
  const expectedSeconds = 120;
  const progressPct = Math.min(95, (elapsed / expectedSeconds) * 100);

  // ── Design mode: AI generation vs direct customer upload ──
  const [designMode, setDesignMode] = useState<"ai" | "direct">("ai");
  const [directImageUrl, setDirectImageUrl] = useState<string | null>(null);
  const [directImagePreview, setDirectImagePreview] = useState<string | null>(null);
  const [uploadingDirect, setUploadingDirect] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [proceedingDirect, setProceedingDirect] = useState(false);

  const [inputMode, setInputMode] = useState<"upload" | "camera" | "pinterest">("upload");
  const [showCamera, setShowCamera] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  // Maps blob URL → Pinterest pin ID so we can show an "Added" badge in the
  // search grid and prevent accidental duplicates. Cleared when the matching
  // reference image is removed.
  const [pinIdByUrl, setPinIdByUrl] = useState<Record<string, string>>({});
  const designsRef = useRef<HTMLDivElement>(null);
  const refinementRef = useRef<HTMLDivElement>(null);

  // Restore state from Supabase on mount (handles full-page reload mid-session).
  // persist middleware will have already filled localStorage state synchronously;
  // this fills in anything missing (e.g. designs from another device).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateFromSession(sessionId);
      if (!cancelled) setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, hydrateFromSession]);

  useEffect(() => {
    // Only redirect once hydration has had a chance to run — otherwise a reload
    // bounces the user back to "/" before persist/Supabase can restore the name.
    if (!hydrating && !customerName) router.replace("/");
  }, [hydrating, customerName, router]);

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

  // Keyboard nav for the lightbox
  useEffect(() => {
    if (viewingIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewingIndex(null);
      if (e.key === "ArrowRight") setViewingIndex((i) => (i === null ? null : (i + 1) % generatedDesigns.length));
      if (e.key === "ArrowLeft") setViewingIndex((i) => (i === null ? null : (i - 1 + generatedDesigns.length) % generatedDesigns.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewingIndex, generatedDesigns.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: 5,
    onDrop: (files) => {
      files.forEach((f) => addReferenceImage(URL.createObjectURL(f)));
    },
  });

  function handleRemoveReference(index: number) {
    const url = referenceImages[index];
    if (url && pinIdByUrl[url]) {
      setPinIdByUrl((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
    removeReferenceImage(index);
  }

  async function handleAddPinterestPin(blobUrl: string, pin: { id: string }) {
    // Add the blob URL immediately so the UI responds instantly
    addReferenceImage(blobUrl);
    setPinIdByUrl((prev) => ({ ...prev, [blobUrl]: pin.id }));

    // Upload to Supabase Storage in the background so the image is
    // persisted permanently (blob URLs die on page refresh and can't
    // be listed from storage for the admin overview).
    try {
      const b64 = await blobUrlToBase64(blobUrl);
      const res = await fetch("/api/upload-ref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, image: b64 }),
      });

      if (res.ok) {
        const { url: permanentUrl } = await res.json();
        // Swap blob URL → permanent Supabase Storage URL
        replaceReferenceImage(blobUrl, permanentUrl);
        setPinIdByUrl((prev) => {
          const next = { ...prev };
          delete next[blobUrl];
          return { ...next, [permanentUrl]: pin.id };
        });
        URL.revokeObjectURL(blobUrl); // free browser memory
      }
    } catch (err) {
      console.warn("Pinterest image upload failed — keeping blob URL:", err);
      // Blob URL stays as fallback; image will still work for this session
    }
  }

  const addedPinIds = referenceImages
    .map((url) => pinIdByUrl[url])
    .filter((id): id is string => Boolean(id));

  // ── Direct upload handlers ────────────────────────────────
  async function handleDirectFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;
    setDirectError(null);
    setUploadingDirect(true);

    // Show a local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setDirectImagePreview(previewUrl);
    setDirectImageUrl(null);

    try {
      const b64 = await blobUrlToBase64(previewUrl);
      const res = await fetch("/api/upload-ref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, image: b64, prefix: "designs" }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setDirectImageUrl(url);
      URL.revokeObjectURL(previewUrl);
      setDirectImagePreview(url);
    } catch (err) {
      setDirectError((err as Error).message);
      setDirectImagePreview(null);
    } finally {
      setUploadingDirect(false);
    }
  }

  async function handleProceedDirect() {
    if (!directImageUrl) return;
    setProceedingDirect(true);
    try {
      const design: DesignVariant = {
        id: `direct-${Date.now()}`,
        imageUrl: directImageUrl,
        gradient: gradients[0],
        patternType: "mandala",
        styleName: "Customer Design",
      };
      const [persisted] = await persistDesigns([design]);
      const finalDesign = persisted ?? design;
      finishGenerating([finalDesign]);
      selectDesign(finalDesign);
      router.push(`/${sessionId}/placement`);
    } catch (err) {
      setDirectError((err as Error).message);
      setProceedingDirect(false);
    }
  }

  const {
    getRootProps: getDirectRootProps,
    getInputProps: getDirectInputProps,
    isDragActive: isDirectDragActive,
  } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: 1,
    onDrop: handleDirectFileDrop,
  });

  const canGenerate = tattooDescription.trim().length > 0;
  const hasGenerated = generatedDesigns.length > 0;
  const hasSelection = selectedDesigns.length > 0;

  const gradients = [
    "radial-gradient(ellipse at 50% 40%, #4a0080 0%, #1a0030 40%, #0d0010 100%)",
    "radial-gradient(ellipse at 40% 35%, #8b0000 0%, #3a0000 40%, #0a0000 100%)",
    "radial-gradient(ellipse at 45% 45%, #1a2a4a 0%, #0a1a2a 50%, #000a0d 100%)",
    "radial-gradient(ellipse at 45% 45%, #c9a84c 0%, #6b4800 50%, #1a1000 100%)",
    "radial-gradient(ellipse at 55% 40%, #1a3a1a 0%, #0a1a08 50%, #000500 100%)",
  ];
  const placeholders = ["mandala", "geometric", "tribal", "floral", "dark"] as const;

  async function callGenerateAPI(payload: Record<string, unknown>) {
    setGenError(null);
    setLastPayload(payload);
    generateDesigns();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const detail = json.details ? ` (${Array.isArray(json.details) ? json.details.join("; ") : JSON.stringify(json.details)})` : "";
        throw new Error(`${json.error ?? "Generation failed"}${detail}`);
      }

      const designs = (json.images as { id: string; imageUrl: string }[]).map(
        (img, i) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          gradient: gradients[i % gradients.length],
          patternType: placeholders[i % placeholders.length],
          styleName: `Variation ${i + 1}${tattooStyle ? ` — ${tattooStyle}` : ""}`,
        })
      );

      // Persist to Supabase and capture the row IDs before showing them
      const persisted = await persistDesigns(designs);
      finishGenerating(persisted);

      // Partial-failure note — keep it informational, not error-state
      if (Array.isArray(json.failures) && json.failures.length > 0) {
        console.warn("[generate] partial failures:", json.failures);
      }
    } catch (err) {
      console.error("Generation error:", err);
      setGenError((err as Error).message);
      finishGenerating([]);
    }
  }

  function handleRetryGenerate() {
    if (lastPayload) callGenerateAPI(lastPayload);
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    const b64Images: string[] = await Promise.all(referenceImages.map(blobUrlToBase64));
    callGenerateAPI({
      sessionId,
      description: tattooDescription,
      style: tattooStyle,
      images: b64Images,
      colors: selectedColors,
      count: 5,
    });
  }

  async function handleRefine() {
    if (!refinementText.trim() || selectedDesigns.length === 0) return;

    const refineImageUrls = selectedDesigns
      .map((d) => d.imageUrl)
      .filter((url): url is string => !!url);

    const selectedDesignNames = selectedDesigns.map((d) => d.styleName);
    const b64Images: string[] = await Promise.all(referenceImages.map(blobUrlToBase64));

    callGenerateAPI({
      sessionId,
      description: tattooDescription,
      style: tattooStyle,
      images: b64Images,
      refineImageUrls,
      refinementText,
      selectedDesignNames,
      colors: selectedColors,
      count: 5,
    });
  }

  function handleProceed() {
    // Use first selected design as the primary
    const primary = selectedDesigns[0];
    if (primary) {
      selectDesign(primary);
      router.push(`/${sessionId}/placement`);
    }
  }

  const viewingDesign = viewingIndex !== null ? generatedDesigns[viewingIndex] : null;
  const viewingIsSelected = viewingDesign ? selectedDesigns.some((d) => d.id === viewingDesign.id) : false;
  const viewingSelectionOrder = viewingDesign ? selectedDesigns.findIndex((d) => d.id === viewingDesign.id) + 1 : 0;
  const viewingCanSelect = !viewingIsSelected && selectedDesigns.length < 4;

  return (
    <>
      <AnimatePresence>
        {showCamera && (
          <CameraCapture
            onCapture={(url) => {
              setShowCamera(false);
              if (designMode === "direct") {
                // In direct mode, camera capture is the design itself
                setDirectImagePreview(url);
                setDirectImageUrl(null);
                blobUrlToBase64(url).then((b64) =>
                  fetch("/api/upload-ref", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, image: b64, prefix: "designs" }),
                  })
                  .then((r) => r.json())
                  .then(({ url: permanentUrl }) => { setDirectImageUrl(permanentUrl); setDirectImagePreview(permanentUrl); })
                  .catch(() => setDirectError("Upload failed — please try again"))
                );
              } else {
                addReferenceImage(url);
              }
            }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Design lightbox modal ─────────────────────────────────── */}
      <AnimatePresence>
        {viewingDesign && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setViewingIndex(null)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewingIndex(null); }}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-surface/80 border border-cleo-border text-ink hover:bg-error/20 hover:border-error/40 hover:text-error transition-colors flex items-center justify-center text-xl leading-none z-10 cursor-pointer"
              aria-label="Close"
            >
              ×
            </button>

            {/* Prev */}
            {generatedDesigns.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingIndex((i) => (i === null ? null : (i - 1 + generatedDesigns.length) % generatedDesigns.length));
                }}
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface/80 border border-cleo-border text-ink hover:bg-gold/20 hover:border-gold/40 hover:text-gold transition-colors flex items-center justify-center z-10 cursor-pointer"
                aria-label="Previous design"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next */}
            {generatedDesigns.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingIndex((i) => (i === null ? null : (i + 1) % generatedDesigns.length));
                }}
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface/80 border border-cleo-border text-ink hover:bg-gold/20 hover:border-gold/40 hover:text-gold transition-colors flex items-center justify-center z-10 cursor-pointer"
                aria-label="Next design"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Content card */}
            <motion.div
              key={viewingDesign.id}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl flex flex-col gap-4 max-h-[90vh]"
            >
              {/* Image */}
              <div
                className="relative rounded-2xl overflow-hidden border-2 border-gold/30 shadow-[0_0_60px_rgba(201,168,76,0.25)]"
                style={{ background: viewingDesign.gradient }}
              >
                <div className="aspect-square max-h-[68vh] mx-auto relative">
                  {viewingDesign.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewingDesign.imageUrl}
                      alt={viewingDesign.styleName}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <DesignPatternSVG type={viewingDesign.patternType} />
                  )}
                </div>

                {/* Badges */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-ink/80 text-xs font-mono px-2.5 py-1 rounded-lg">
                  #{viewingIndex! + 1} of {generatedDesigns.length}
                </div>
                {viewingIsSelected && (
                  <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-gold shadow-lg flex items-center justify-center">
                    <span className="text-bg text-sm font-black font-mono">{viewingSelectionOrder}</span>
                  </div>
                )}
              </div>

              {/* Info + Action bar */}
              <div className="bg-surface border border-cleo-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-cinzel text-base sm:text-lg font-bold text-ink leading-tight truncate">
                    {viewingDesign.styleName}
                  </p>
                  <p className="text-muted text-xs mt-0.5">
                    {viewingIsSelected
                      ? `Currently selected — position #${viewingSelectionOrder}`
                      : viewingCanSelect
                      ? "Tap select to add this design to your selection"
                      : "Selection limit reached (4) — deselect another to add this"}
                  </p>
                </div>

                <motion.button
                  whileHover={viewingIsSelected || viewingCanSelect ? { scale: 1.03 } : {}}
                  whileTap={viewingIsSelected || viewingCanSelect ? { scale: 0.97 } : {}}
                  onClick={() => {
                    if (viewingIsSelected || viewingCanSelect) {
                      toggleDesignSelection(viewingDesign);
                    }
                  }}
                  disabled={!viewingIsSelected && !viewingCanSelect}
                  className={[
                    "px-6 py-3 rounded-xl font-cinzel font-bold text-sm tracking-[0.08em] uppercase border transition-colors cursor-pointer whitespace-nowrap",
                    viewingIsSelected
                      ? "bg-surface-2 border-error/40 text-error hover:bg-error/10"
                      : viewingCanSelect
                      ? "bg-gold border-gold text-bg hover:bg-gold-light shadow-[0_0_20px_rgba(201,168,76,0.3)]"
                      : "bg-surface-2 border-cleo-border text-muted cursor-not-allowed",
                  ].join(" ")}
                >
                  {viewingIsSelected ? "✕ Deselect" : viewingCanSelect ? "✓ Select" : "Limit Reached"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 page-with-mobile-footer flex flex-col gap-6 sm:gap-8">
        {/* Heading */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-gold text-[11px] sm:text-xs font-mono tracking-[0.2em] uppercase mb-1.5">Step 1 of 2 — Design</p>
          <h1 className="font-cinzel text-xl sm:text-3xl font-black text-ink leading-tight">
            {designMode === "ai" ? "Describe your tattoo" : "Upload existing design"}
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1.5 sm:mt-2 leading-relaxed">
            {designMode === "ai"
              ? "Choose a style, describe your idea, and optionally add a reference image."
              : "Customer has a ready design — upload it and proceed directly to placement."}
          </p>
        </motion.div>

        {/* ── Mode switcher ──────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.04 }}
          className="flex gap-2 p-1 bg-surface rounded-xl border border-cleo-border w-full sm:w-fit">
          {[
            { mode: "ai" as const, label: "✦ AI Design", desc: "Generate with AI" },
            { mode: "direct" as const, label: "↑ Upload Existing", desc: "Customer has a design" },
          ].map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setDesignMode(mode)}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-cinzel font-bold text-xs tracking-[0.08em] uppercase transition-all cursor-pointer ${
                designMode === mode
                  ? "bg-gold text-bg shadow-[0_0_12px_rgba(201,168,76,0.3)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {/* ── Direct upload card ─────────────────────────────────── */}
        {designMode === "direct" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-surface rounded-2xl border border-cleo-border p-4 sm:p-6 flex flex-col gap-5"
          >
            {!directImagePreview ? (
              /* Drop zone */
              <div
                {...getDirectRootProps()}
                className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed py-14 px-6 text-center cursor-pointer transition-colors ${
                  isDirectDragActive ? "border-gold bg-gold/5" : "border-cleo-border hover:border-gold/50 hover:bg-surface-2"
                }`}
              >
                <input {...getDirectInputProps()} />
                {uploadingDirect ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted text-sm font-mono">Uploading…</p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-ink font-cinzel font-bold text-sm">
                        {isDirectDragActive ? "Drop the image here" : "Drop the design image"}
                      </p>
                      <p className="text-muted text-xs mt-1">or click to browse · JPG, PNG, WEBP</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCamera(true);
                      }}
                      className="text-xs font-mono text-muted hover:text-gold transition-colors underline underline-offset-2 cursor-pointer"
                    >
                      Use camera instead
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Preview + actions */
              <div className="flex flex-col gap-4">
                <div className="relative rounded-xl overflow-hidden border-2 border-gold/40 aspect-square max-h-72 mx-auto w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={directImagePreview} alt="Customer design" className="w-full h-full object-contain bg-surface-2" />
                  {uploadingDirect && (
                    <div className="absolute inset-0 bg-bg/70 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => { setDirectImagePreview(null); setDirectImageUrl(null); setDirectError(null); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-bg/80 border border-cleo-border text-muted hover:text-error transition-colors flex items-center justify-center text-lg cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {directError && (
                  <p className="text-error text-sm font-mono text-center">{directError}</p>
                )}

                <motion.button
                  onClick={handleProceedDirect}
                  disabled={!directImageUrl || uploadingDirect || proceedingDirect}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 bg-gold text-bg font-cinzel font-bold text-base tracking-[0.1em] uppercase rounded-xl border border-gold hover:bg-gold-light transition-colors shadow-[0_0_24px_rgba(201,168,76,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {proceedingDirect ? "Saving…" : uploadingDirect ? "Uploading…" : "✦ Proceed to Placement →"}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── AI Design mode content ────────────────────────────── */}
        {designMode === "ai" && <>

        {/* ── Input card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-surface rounded-2xl border border-cleo-border p-4 sm:p-6 flex flex-col gap-5"
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

          {/* Colour palette */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
                Palette <span className="text-muted/40 normal-case">(optional)</span>
              </label>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className={selectedColors.length > 0 ? "text-gold" : "text-muted/60"}>
                  {selectedColors.length === 0
                    ? "Black & grey"
                    : `${selectedColors.length} ink${selectedColors.length === 1 ? "" : "s"}`}
                </span>
                {selectedColors.length > 0 && (
                  <button
                    onClick={() => clearColors()}
                    className="text-muted hover:text-gold transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-thin">
              {TATTOO_COLORS.map((c) => {
                const isSelected = selectedColors.some(
                  (h) => h.toUpperCase() === c.hex.toUpperCase()
                );
                // Luminance — light swatches need a visible border on the dark card,
                // and the checkmark must flip to dark ink to stay readable on them.
                const r = parseInt(c.hex.slice(1, 3), 16);
                const g = parseInt(c.hex.slice(3, 5), 16);
                const b = parseInt(c.hex.slice(5, 7), 16);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                const checkColor = luminance > 0.55 ? "#0A0A0A" : "#F5F5F5";

                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => toggleColor(c.hex)}
                    title={`${c.name} — ${c.usage}`}
                    aria-label={`${c.name} ${isSelected ? "(selected)" : ""}`}
                    aria-pressed={isSelected}
                    className={[
                      "group relative flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-md cursor-pointer transition-all duration-150",
                      "ring-1 ring-inset",
                      isSelected
                        ? "ring-gold shadow-[0_0_0_2px_rgba(201,168,76,0.35)] -translate-y-0.5"
                        : "ring-white/10 hover:ring-gold/50 hover:-translate-y-0.5",
                    ].join(" ")}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={checkColor}
                        strokeWidth={3.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute inset-1 pointer-events-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {/* Hover tooltip — anchored ABOVE the swatch so it never collides with the next row */}
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap text-[10px] font-mono text-ink bg-bg border border-cleo-border px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
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
              <div className="flex items-center gap-1 bg-bg rounded-lg border border-cleo-border p-0.5 w-full sm:w-auto">
                {(["upload", "camera", "pinterest"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-cinzel tracking-wide transition-all whitespace-nowrap ${inputMode === mode ? "bg-gold text-bg font-bold" : "text-muted hover:text-ink"}`}
                  >
                    {mode === "upload" ? "📁 Upload" : mode === "camera" ? "📷 Camera" : "🔍 Pinterest"}
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
                        onClick={() => handleRemoveReference(i)}
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
              {inputMode === "pinterest" && (
                <motion.div key="pinterest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <PinterestSearch
                    onAdd={handleAddPinterestPin}
                    remainingSlots={5 - referenceImages.length}
                    addedPinIds={addedPinIds}
                  />
                </motion.div>
              )}
              {referenceImages.length >= 5 && inputMode !== "pinterest" && (
                <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
                  <p className="text-muted text-xs font-mono">Maximum 5 reference images reached</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error */}
          {genError && !isGenerating && (
            <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-error text-xs font-mono leading-relaxed break-words">{genError}</p>
                <p className="text-muted text-[10px] mt-1">
                  Usually a transient AI service issue. Tap Retry to try again.
                </p>
              </div>
              <button
                onClick={handleRetryGenerate}
                disabled={isGenerating || !lastPayload}
                className="flex-shrink-0 bg-gold text-bg font-cinzel font-bold text-[10px] tracking-[0.1em] uppercase px-3 py-2 rounded-lg border border-gold hover:bg-gold-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ↺ Retry
              </button>
            </div>
          )}

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
                <motion.p
                  key={stageIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-muted text-sm mt-1"
                >
                  {STAGE_MESSAGES[stageIdx]}
                </motion.p>
                <p className="text-muted/60 text-[10px] font-mono tracking-widest mt-3 uppercase">
                  {elapsed}s elapsed · usually takes 1–2 min
                </p>
              </div>
              <div className="w-64 h-1 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gold rounded-full"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3 w-full max-w-lg">
                {Array.from({ length: 5 }).map((_, i) => (
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
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-cinzel text-lg sm:text-xl font-bold text-ink leading-tight">
                    {iterationCount > 1 ? `Refined Designs — Pass ${iterationCount}` : "Your Designs"}
                  </h2>
                  <p className="text-muted text-[11px] sm:text-xs mt-0.5 leading-snug">
                    {hasSelection
                      ? `${selectedDesigns.length} selected — refine or proceed`
                      : "Tap a design to view it full-size, then select"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  {hasSelection && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => clearDesignSelection()}
                      className="text-muted text-[11px] font-cinzel tracking-wide hover:text-gold transition-colors px-2 py-1 rounded border border-cleo-border hover:border-gold/40 cursor-pointer"
                    >
                      Clear
                    </motion.button>
                  )}
                  <span className={`text-[10px] font-mono px-2 sm:px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
                    hasSelection
                      ? "text-gold border-gold/40 bg-gold/10"
                      : "text-muted border-cleo-border"
                  }`}>
                    {hasSelection ? `${selectedDesigns.length} / 4` : "5 variations"}
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
                      onClick={() => setViewingIndex(i)}
                      className={[
                        "relative rounded-2xl overflow-hidden text-left border-2 transition-all duration-250 cursor-pointer group",
                        isSelected
                          ? "border-gold shadow-[0_0_20px_rgba(201,168,76,0.45)]"
                          : "border-cleo-border hover:border-gold/40",
                      ].join(" ")}
                    >
                      {/* Artwork */}
                      <div className="aspect-square relative" style={{ background: design.gradient }}>
                        {design.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={design.imageUrl}
                            alt={design.styleName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <DesignPatternSVG type={design.patternType} />
                        )}

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

                        {/* Hover hint: View */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-gold text-bg font-cinzel text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1.5 rounded-lg shadow-lg">
                            🔍 View
                          </span>
                        </div>
                      </div>

                      <div className={`px-3 py-2.5 transition-colors ${isSelected ? "bg-gold/10" : "bg-surface"}`}>
                        <p className={`text-xs font-cinzel font-bold leading-tight ${isSelected ? "text-gold" : "text-ink"}`}>
                          {design.styleName}
                        </p>
                        <p className="text-muted text-[10px] mt-0.5">
                          {isSelected ? `Selected #${selectionOrder}` : "Tap to view"}
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
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-4 border-b border-cleo-border/60">
                <p className="text-gold text-[11px] sm:text-xs font-mono tracking-[0.15em] uppercase mb-1">
                  You selected {selectedDesigns.length} design{selectedDesigns.length > 1 ? "s" : ""}
                </p>
                {selectedDesigns.length > 1 && (
                  <p className="text-muted text-[10px] font-mono mb-3 leading-snug">
                    Refer to them as &quot;Image 1&quot;, &quot;Image 2&quot;, etc. in your refinement notes below
                  </p>
                )}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {selectedDesigns.map((d, i) => {
                    const globalIndex = generatedDesigns.findIndex((gd) => gd.id === d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-2 bg-bg rounded-xl border border-gold/20 p-1.5 sm:p-2 pr-2.5 sm:pr-3">
                        <div className="relative">
                          <div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0 relative"
                            style={{ background: d.gradient }}
                          >
                            {d.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={d.imageUrl} alt={d.styleName} className="w-full h-full object-cover" />
                            ) : (
                              <DesignPatternSVG type={d.patternType} />
                            )}
                          </div>
                          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                            <span className="text-bg text-[9px] font-black">{i + 1}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-ink text-[11px] sm:text-xs font-cinzel font-bold leading-tight truncate max-w-[120px] sm:max-w-[160px]">{d.styleName}</p>
                          <p className="text-muted text-[9px] truncate">
                            {selectedDesigns.length > 1 ? `→ "Image ${i + 1}"` : `Design #${globalIndex + 1}`}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleDesignSelection(d)}
                          aria-label={`Remove ${d.styleName}`}
                          className="ml-1 w-6 h-6 flex items-center justify-center text-muted hover:text-error transition-colors text-base leading-none cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-4">
                {/* Refinement input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
                    What do you like? What to change?
                  </label>
                  <textarea
                    rows={3}
                    placeholder={
                      selectedDesigns.length > 1
                        ? `e.g. I love the linework style of Image 1 (${selectedDesigns[0]?.styleName}) and the colour/shading of Image 2 (${selectedDesigns[1]?.styleName}). Combine them — keep Image 1's composition but use Image 2's shading technique…`
                        : `e.g. Keep the overall composition of ${selectedDesigns[0]?.styleName ?? "this design"} but make the linework bolder, add more detail in the centre, and darken the shading…`
                    }
                    value={refinementText}
                    onChange={(e) => setRefinementText(e.target.value)}
                    className="bg-bg border border-cleo-border rounded-xl px-4 py-3 text-ink text-sm placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Inline buttons — hidden on mobile in favour of the sticky footer */}
                <div className="hidden sm:flex flex-col sm:flex-row gap-3">
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

        </>} {/* end designMode === "ai" */}
      </div>

      {/* ── Sticky mobile CTA bar (AI mode only) */}
      {designMode === "ai" && <>{/* ── Sticky mobile CTA bar ─────────────────────────────────────
          Mirrors the primary action for the current state so the user
          never has to scroll back up. Inline desktop buttons remain. */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-cleo-border px-4 pt-3 pb-safe">
        {isGenerating ? (
          <button
            disabled
            className="w-full py-3.5 rounded-xl font-cinzel font-bold text-sm tracking-[0.08em] uppercase bg-surface-2 text-muted border border-cleo-border cursor-not-allowed"
          >
            Generating…
          </button>
        ) : hasSelection ? (
          <div className="flex gap-2">
            <button
              onClick={handleRefine}
              disabled={!refinementText.trim()}
              className={`flex-1 py-3 rounded-xl font-cinzel font-bold text-[11px] tracking-[0.06em] uppercase border transition-colors ${
                refinementText.trim()
                  ? "bg-surface-2 border-gold/40 text-gold cursor-pointer"
                  : "bg-surface-2 border-cleo-border text-muted/50 cursor-not-allowed"
              }`}
            >
              ↺ Refine
            </button>
            <button
              onClick={handleProceed}
              className="flex-[1.4] py-3 rounded-xl font-cinzel font-bold text-sm tracking-[0.06em] uppercase bg-gold text-bg border border-gold cursor-pointer shadow-[0_0_18px_rgba(201,168,76,0.25)]"
            >
              ✦ Proceed →
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full py-3.5 rounded-xl font-cinzel font-bold text-sm tracking-[0.08em] uppercase border transition-colors ${
              canGenerate
                ? "bg-gold text-bg border-gold cursor-pointer shadow-[0_0_18px_rgba(201,168,76,0.25)]"
                : "bg-surface-2 text-muted border-cleo-border cursor-not-allowed"
            }`}
          >
            {hasGenerated ? "✦ Regenerate" : canGenerate ? "✦ Generate Designs" : "Describe your tattoo first"}
          </button>
        )}
      </div>
      </>} {/* end designMode === "ai" sticky CTA */}
    </>
  );
}
