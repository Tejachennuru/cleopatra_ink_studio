import jsPDF from "jspdf";

// Aspect ratios shown on the print proof.
const RATIOS: Array<{ label: string; w: number; h: number }> = [
  { label: "1:1",  w: 1,  h: 1  },
  { label: "4:3",  w: 4,  h: 3  },
  { label: "3:2",  w: 3,  h: 2  },
  { label: "16:9", w: 16, h: 9  },
  { label: "9:16", w: 9,  h: 16 },
  { label: "4:5",  w: 4,  h: 5  },
];

// Supabase Storage URLs need to be proxied client-side to avoid CORS taint when
// we hand them to jsPDF (which serializes via canvas). The existing proxy route
// already handles this for the placement editor.
function resolveImageSrc(src: string): string {
  if (src.startsWith("blob:") || src.startsWith("data:")) return src;
  return `/api/proxy-image?url=${encodeURIComponent(src)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const isLocal = src.startsWith("blob:") || src.startsWith("data:");
    if (!isLocal) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load tattoo image: ${src}`));
    img.src = resolveImageSrc(src);
  });
}

// Render the source image onto a square canvas at fixed resolution so the PDF
// gets a clean, deterministic JPEG regardless of the source's native size.
function imageToSquareJpeg(img: HTMLImageElement, size = 1024): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // Letterbox so we never distort even if the source isn't perfectly square.
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let drawW = size;
  let drawH = size;
  if (srcRatio > 1) drawH = size / srcRatio;
  else if (srcRatio < 1) drawW = size * srcRatio;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas.toDataURL("image/jpeg", 0.95);
}

export interface TattooPdfOptions {
  imageUrl: string;
  /** Used in the header sub-line (e.g. session ID or style name). Optional. */
  subtitle?: string;
  /** Filename for the downloaded PDF. Defaults to "tattoo-sizes.pdf". */
  filename?: string;
}

/**
 * Render an A4 PDF showing the tattoo design in 6 aspect-ratio frames
 * (1:1, 4:3, 3:2, 16:9, 9:16, 4:5) and trigger a download.
 */
export async function downloadTattooSizesPdf({
  imageUrl,
  subtitle,
  filename = "tattoo-sizes.pdf",
}: TattooPdfOptions): Promise<void> {
  const img = await loadImage(imageUrl);
  const tattooDataUrl = imageToSquareJpeg(img);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ── Page geometry (mm) ───────────────────────────────────────────
  const pageW = 210;
  const pageH = 297;
  const marginX = 12;
  const headerH = 22;
  const footerH = 12;

  // ── Header ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text("Tattoo Size Preview", pageW / 2, 13, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const sub = subtitle ? `${subtitle} · ` : "";
  doc.text(`${sub}Cleopatra Ink Studio`, pageW / 2, 19, { align: "center" });

  // Header divider
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(marginX, 22, pageW - marginX, 22);

  // ── 2×3 grid of cells ────────────────────────────────────────────
  const cols = 2;
  const rows = 3;
  const gutter = 6;
  const gridX = marginX;
  const gridY = headerH + 4;
  const gridW = pageW - 2 * marginX;
  const gridH = pageH - headerH - footerH - 8;
  const cellW = (gridW - gutter * (cols - 1)) / cols;
  const cellH = (gridH - gutter * (rows - 1)) / rows;

  RATIOS.forEach((r, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = gridX + col * (cellW + gutter);
    const y = gridY + row * (cellH + gutter);

    // Cell label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(r.label, x + cellW / 2, y + 5, { align: "center" });

    // Area for the aspect-ratio frame, below the label
    const labelGap = 8;
    const innerX = x;
    const innerY = y + labelGap;
    const innerW = cellW;
    const innerH = cellH - labelGap;

    // Fit an aspect-ratio rectangle inside the cell's inner area
    const ratio = r.w / r.h;
    let frameW = innerW;
    let frameH = frameW / ratio;
    if (frameH > innerH) {
      frameH = innerH;
      frameW = frameH * ratio;
    }
    const frameX = innerX + (innerW - frameW) / 2;
    const frameY = innerY + (innerH - frameH) / 2;

    // Soft frame fill + border so the proportions are visible at a glance
    doc.setFillColor(252, 252, 252);
    doc.setDrawColor(180);
    doc.setLineWidth(0.25);
    doc.rect(frameX, frameY, frameW, frameH, "FD");

    // Square tattoo centered inside the frame (no distortion)
    const tattooSize = Math.min(frameW, frameH) * 0.92;
    const tx = frameX + (frameW - tattooSize) / 2;
    const ty = frameY + (frameH - tattooSize) / 2;
    doc.addImage(tattooDataUrl, "JPEG", tx, ty, tattooSize, tattooSize);

    // Dimension hint (e.g. "16 × 9")
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `${r.w} × ${r.h}`,
      x + cellW / 2,
      y + cellH - 1.5,
      { align: "center" }
    );
  });

  // ── Footer ───────────────────────────────────────────────────────
  doc.setDrawColor(230);
  doc.line(marginX, pageH - footerH, pageW - marginX, pageH - footerH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Generated ${new Date().toLocaleDateString()}  ·  Print at 100% scale for accurate proportions`,
    pageW / 2,
    pageH - 5,
    { align: "center" }
  );

  doc.save(filename);
}
