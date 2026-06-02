"use client";

import { useRef, useState, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  SHEET_COUNTS,
  STENCIL_MARGIN_MM,
  computeStencilLayout,
  defaultStencilCenter,
  loadTrimmedStencilImage,
  downloadTattooStencilPdf,
  type SheetCount,
} from "@/lib/tattoo-pdf";

interface Props {
  imageUrl: string;
  /** Used to compose the download filename. */
  subtitle?: string;
  filenameBase?: string;
  onClose: () => void;
}

const MIN_PERCENT = 20;
const MAX_PERCENT = 200;

export default function TattooPrintStudio({ imageUrl, subtitle, filenameBase = "tattoo-stencil", onClose }: Props) {
  const [count, setCount] = useState<SheetCount>(1);
  const [sizePercent, setSizePercent] = useState(100);
  const [mirrored, setMirrored] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [center, setCenter] = useState(() => defaultStencilCenter(1));

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  // Load the design once and trim its empty frame so sizing/positioning track
  // the actual ink. The trimmed image is reused for both preview and PDF.
  useEffect(() => {
    let cancelled = false;
    loadTrimmedStencilImage(imageUrl)
      .then((loaded) => {
        if (cancelled) return;
        setImg(loaded);
        setAspect(loaded.naturalWidth > 0 ? loaded.naturalWidth / loaded.naturalHeight : 1);
      })
      .catch((err) => !cancelled && setLoadError((err as Error).message));
    return () => { cancelled = true; };
  }, [imageUrl]);

  // Switch sheet count and recentre in one step (the grid resizes under it).
  function handleCountChange(n: SheetCount) {
    setCount(n);
    setCenter(defaultStencilCenter(n));
  }

  // Measure the available preview area so we can scale mm → px to fit.
  // setStage runs only from the ResizeObserver callback (an external-system
  // subscription), which also fires once on observe() for the initial size.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cols, rows, totalW, totalH, tattooLeft, tattooTop, tattooW, tattooH } = useMemo(
    () => computeStencilLayout({ count, sizePercent, aspect, center }),
    [count, sizePercent, aspect, center]
  );

  // Fit the whole grid inside the stage with a little breathing room.
  const { scale, dispW, dispH } = useMemo(() => {
    const pad = 24;
    const availW = Math.max(0, stage.w - pad * 2);
    const availH = Math.max(0, stage.h - pad * 2);
    const s = availW > 0 && availH > 0 ? Math.min(availW / totalW, availH / totalH) : 0;
    return { scale: s, dispW: totalW * s, dispH: totalH * s };
  }, [stage.w, stage.h, totalW, totalH]);

  // ── Drag the tattoo across the grid ───────────────────────────────
  const dragRef = useRef<{ startMX: number; startMY: number; startCX: number; startCY: number } | null>(null);

  const onDragMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || scale <= 0) return;
    const dxMm = (e.clientX - d.startMX) / scale;
    const dyMm = (e.clientY - d.startMY) / scale;
    setCenter({
      x: Math.min(totalW, Math.max(0, d.startCX + dxMm)),
      y: Math.min(totalH, Math.max(0, d.startCY + dyMm)),
    });
  }, [scale, totalW, totalH]);

  function handleDragDown(e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { startMX: e.clientX, startMY: e.clientY, startCX: center.x, startCY: center.y };
    // Hoisted declarations so `up` can deregister itself without a use-before-define.
    function move(ev: PointerEvent) { onDragMove(ev); }
    function up() {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function handleDownload() {
    if (downloading || !img) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadTattooStencilPdf({
        imageUrl,
        image: img,
        count,
        sizePercent,
        mirrored,
        rotation,
        center,
        subtitle,
        filename: `${filenameBase}-${count}xA4.pdf`,
      });
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const gridStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  }), [cols, rows]);

  const tattooImgStyle = useMemo(() => ({
    left: tattooLeft * scale,
    top: tattooTop * scale,
    width: tattooW * scale,
    height: tattooH * scale,
    maxWidth: "none" as const,
    maxHeight: "none" as const,
    transform: `${mirrored ? "scaleX(-1) " : ""}rotate(${rotation}deg)`,
    touchAction: "none" as const,
    objectFit: "contain" as const,
  }), [tattooLeft, tattooTop, tattooW, tattooH, scale, mirrored, rotation]);

  const safeAreaStyle = useMemo(() => ({
    left: STENCIL_MARGIN_MM * scale,
    top: STENCIL_MARGIN_MM * scale,
    right: STENCIL_MARGIN_MM * scale,
    bottom: STENCIL_MARGIN_MM * scale,
    border: "1px solid #b4b4b4",
  }), [scale]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col lg:flex-row"
    >
      {/* ── Lightroom preview (left / center) ───────────────────────── */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10">
          <div>
            <p className="text-gold text-[10px] font-mono tracking-[0.2em] uppercase">Print Studio</p>
            <p className="text-white/60 text-xs font-mono mt-0.5">
              {cols}×{rows} grid · {totalW}×{totalH}mm · print at 100%
            </p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden w-9 h-9 rounded-full bg-white/10 text-white hover:bg-error/30 transition-colors flex items-center justify-center text-xl cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div ref={stageRef} className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
          {loadError ? (
            <p className="text-error text-sm font-mono max-w-xs text-center">{loadError}</p>
          ) : !img || scale <= 0 ? (
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          ) : (
            <div
              className="relative shadow-2xl select-none overflow-hidden"
              style={{ width: dispW, height: dispH, background: "#ffffff" }}
            >
              {/* Sheet grid overlay — dashed lines show where to cut & tape */}
              <div
                className="absolute inset-0 grid pointer-events-none z-10"
                style={gridStyle}
              >
                {Array.from({ length: cols * rows }).map((_, i) => (
                  <div
                    key={i}
                    className="border border-dashed border-gold/40 flex items-start justify-start"
                  >
                    <span className="m-1 text-[8px] font-mono text-gold/50 bg-white/70 px-1 rounded">
                      {cols * rows > 1 ? `R${Math.floor(i / cols) + 1}·C${(i % cols) + 1}` : "A4"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Safe-area guide — matches the thin grey line in the PDF.
                  Single rectangle around the assembled grid (not per sheet),
                  inset by the printer-safe margin. Visual only — the tattoo
                  is not clipped to it. */}
              <div
                aria-hidden
                className="absolute pointer-events-none z-30"
                style={safeAreaStyle}
              />

              {/* Tattoo — draggable, mirrored in place when toggled */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt="Tattoo stencil"
                onPointerDown={handleDragDown}
                draggable={false}
                className="absolute z-20 cursor-move"
                style={tattooImgStyle}
              />
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-2 border-t border-white/10">
          <p className="text-white/40 text-[10px] font-mono text-center">
            Drag the design to reposition · Print at 100% · Grey border = {STENCIL_MARGIN_MM}mm printer safe-area
          </p>
        </div>
      </div>

      {/* ── Right sidebar — controls ─────────────────────────────────── */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-surface border-t lg:border-t-0 lg:border-l border-cleo-border flex flex-col">
        <div className="hidden lg:flex items-center justify-between px-5 py-4 border-b border-cleo-border">
          <h2 className="font-cinzel text-sm font-bold tracking-[0.15em] text-ink uppercase">Stencil Options</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 text-muted hover:text-error transition-colors flex items-center justify-center text-lg cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {/* A4 count */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted">How many A4 sheets</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SHEET_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => handleCountChange(n)}
                  className={`py-2.5 rounded-lg font-cinzel font-bold text-sm border transition-all cursor-pointer ${
                    count === n
                      ? "bg-gold text-bg border-gold shadow-[0_0_12px_rgba(201,168,76,0.3)]"
                      : "bg-bg text-muted border-cleo-border hover:border-gold/40 hover:text-ink"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-muted/50 text-[10px] font-mono">One large tattoo split across the sheets.</p>
          </div>

          {/* Size percentage */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted">Size adjustment</label>
              <span className="text-gold text-xs font-mono font-bold">{sizePercent}%</span>
            </div>
            <input
              type="range"
              min={MIN_PERCENT}
              max={MAX_PERCENT}
              step={1}
              value={sizePercent}
              onChange={(e) => setSizePercent(Number(e.target.value))}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-muted/40">
              <span>{MIN_PERCENT}%</span>
              <span>100%</span>
              <span>{MAX_PERCENT}%</span>
            </div>
            <p className="text-muted/50 text-[10px] font-mono">
              Tattoo ≈ {Math.round(tattooW)}×{Math.round(tattooH)}mm on paper.
            </p>
          </div>

          {/* Rotation */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted">Rotation</label>
              <span className="text-gold text-xs font-mono font-bold">{rotation}°</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  onClick={() => setRotation(deg)}
                  className={`py-2 rounded-lg font-mono text-xs border transition-all cursor-pointer ${
                    rotation === deg
                      ? "bg-gold text-bg border-gold"
                      : "bg-bg text-muted border-cleo-border hover:border-gold/40 hover:text-ink"
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full accent-gold cursor-pointer"
            />
          </div>

          {/* Mirror toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted block">Mirror for skin transfer</label>
              <p className="text-muted/50 text-[10px] font-mono mt-0.5 leading-snug">
                Flips the design so it reads correctly once the stencil is pressed onto skin. Keep ON — vital for text. Off prints it as-drawn.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={mirrored}
              onClick={() => setMirrored((m) => !m)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${mirrored ? "bg-gold" : "bg-surface-2 border border-cleo-border"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${mirrored ? "left-[26px]" : "left-0.5"}`}
              />
            </button>
          </div>
        </div>

        {/* Download */}
        <div className="px-5 py-4 border-t border-cleo-border flex flex-col gap-2">
          {downloadError && (
            <p className="text-error text-[11px] font-mono leading-snug break-words">{downloadError}</p>
          )}
          <motion.button
            whileHover={img && !downloading ? { scale: 1.02 } : {}}
            whileTap={img && !downloading ? { scale: 0.97 } : {}}
            onClick={handleDownload}
            disabled={!img || downloading}
            className="w-full py-3.5 rounded-xl bg-gold text-bg font-cinzel font-bold text-sm tracking-[0.1em] uppercase border border-gold hover:bg-gold-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(201,168,76,0.2)]"
          >
            {downloading ? (
              <>
                <span className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download {count} × A4 PDF
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
