import { NextRequest, NextResponse } from "next/server";
import { createKeiTask, waitForKeiTask, KeiTaskFailedError } from "@/lib/kei-api";
import { buildPlacementPrompt, buildCompositePrompt } from "@/lib/prompts";
import { uploadBase64, uploadFromUrl } from "@/lib/storage";

export const maxDuration = 300;

type KeiRunResult =
  | { ok: true; url: string; taskId: string }
  | { ok: false; kind: "failed" | "timeout" | "error"; reason: string; taskId?: string };

// Final body-placement image is rendered with Gemini 3 Pro Image (nano-banana-pro)
// via KEI for higher photorealism. Design generation still uses gpt-image.
const PLACEMENT_MODEL = "nano-banana-pro" as const;

// Single attempt at a KEI generation. Caller decides whether to retry.
async function runKeiOnce(prompt: string, inputUrls: string[]): Promise<KeiRunResult> {
  let taskId: string | undefined;
  try {
    taskId = await createKeiTask(prompt, inputUrls, { model: PLACEMENT_MODEL });
    const url = await waitForKeiTask(taskId);
    return { ok: true, url, taskId };
  } catch (err) {
    if (err instanceof KeiTaskFailedError) {
      return { ok: false, kind: "failed", reason: err.failMsg ?? err.message, taskId: err.taskId };
    }
    const reason = (err as Error).message;
    const kind: "timeout" | "error" = /timed out/i.test(reason) ? "timeout" : "error";
    return { ok: false, kind, reason, taskId };
  }
}

// Up to two attempts: one retry on real failures (KEI 5xx, "Internal Error",
// moderation flake). Timeouts are not retried — KEI is congested, retry would
// just queue the same job and burn the request budget.
async function runKeiWithRetry(prompt: string, inputUrls: string[]): Promise<KeiRunResult> {
  const first = await runKeiOnce(prompt, inputUrls);
  if (first.ok || first.kind === "timeout") return first;
  console.warn(`[placement] KEI ${first.kind} (${first.reason}) — retrying once`);
  return runKeiOnce(prompt, inputUrls);
}


export async function POST(req: NextRequest) {
  const { sessionId, tattooImageUrl, bodyImageB64, compositeImageB64, placementText } = await req.json();

  if (!tattooImageUrl && !compositeImageB64) {
    return NextResponse.json({ error: "tattooImageUrl or compositeImageB64 is required" }, { status: 400 });
  }

  // ── Composite mode: user manually positioned the tattoo ──────────────
  // Sends 3 images: composite (position) + tattoo design (detail) + body photo (skin/light)
  if (compositeImageB64) {
    let compositeUrl: string;
    let bodyPhotoStorageUrl: string | null = null;

    try {
      compositeUrl = await uploadBase64(compositeImageB64 as string, sessionId, "composites");
    } catch (err) {
      return NextResponse.json(
        { error: `Composite upload failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }

    // Image 1: composite (exact position reference)
    // Image 2: clean tattoo design (detail reference) — already a hosted Supabase URL
    // Image 3: original body photo (skin/lighting reference)
    const inputUrls: string[] = [compositeUrl];
    if (tattooImageUrl) inputUrls.push(tattooImageUrl as string);
    if (bodyImageB64) {
      try {
        const bodyUrl = await uploadBase64(bodyImageB64 as string, sessionId, "body");
        inputUrls.push(bodyUrl);
        bodyPhotoStorageUrl = bodyUrl;
      } catch {
        // Non-fatal — proceed with 2 images if body upload fails
        console.warn("[placement] Body photo upload failed — proceeding with 2-image composite");
      }
    }

    const result = await runKeiWithRetry(buildCompositePrompt(), inputUrls);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, kind: result.kind, taskId: result.taskId },
        { status: result.kind === "timeout" ? 504 : 502 }
      );
    }

    try {
      const imageUrl = await uploadFromUrl(result.url, sessionId, "previews");
      return NextResponse.json({ imageUrl, bodyPhotoUrl: bodyPhotoStorageUrl ?? compositeUrl, taskId: result.taskId });
    } catch (err) {
      return NextResponse.json(
        { error: `Result upload failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // ── Standard mode: separate tattoo + optional body photo ─────────────
  const hasBodyPhoto = !!bodyImageB64;
  const inputUrls: string[] = [tattooImageUrl];
  let bodyPhotoStorageUrl: string | null = null;

  if (hasBodyPhoto) {
    try {
      bodyPhotoStorageUrl = await uploadBase64(bodyImageB64 as string, sessionId, "body");
      inputUrls.push(bodyPhotoStorageUrl);
    } catch (err) {
      return NextResponse.json(
        { error: `Body photo upload failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  const prompt = buildPlacementPrompt(placementText ?? "", hasBodyPhoto);
  const result = await runKeiWithRetry(prompt, inputUrls);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, kind: result.kind, taskId: result.taskId },
      { status: result.kind === "timeout" ? 504 : 502 }
    );
  }

  try {
    const imageUrl = await uploadFromUrl(result.url, sessionId, "previews");
    return NextResponse.json({ imageUrl, bodyPhotoUrl: bodyPhotoStorageUrl, taskId: result.taskId });
  } catch (err) {
    return NextResponse.json(
      { error: `Result upload failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
