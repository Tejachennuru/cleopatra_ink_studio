import { NextRequest, NextResponse } from "next/server";
import { buildTattooPrompt, createKeiTask, waitForKeiTask, KeiTaskFailedError } from "@/lib/kei-api";
import type { RefinementInfo } from "@/lib/kei-api";
import { uploadBase64, uploadFromUrl } from "@/lib/storage";

type RunResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; kind: "failed" | "timeout" | "error"; taskId?: string; failCode?: string | number };

async function runOneTask(prompt: string, inputUrls: string[]): Promise<RunResult> {
  let taskId: string | undefined;
  try {
    taskId = await createKeiTask(prompt, inputUrls);
    const url = await waitForKeiTask(taskId);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof KeiTaskFailedError) {
      return { ok: false, kind: "failed", reason: err.failMsg ?? "Unknown KEI failure", taskId: err.taskId, failCode: err.failCode };
    }
    const reason = (err as Error).message;
    // Distinguish KEI queue/poll timeouts from other transport errors — we only
    // retry true model failures (moderation, etc.), since retrying a timeout
    // just queues the same job again and burns the request budget.
    const kind: "timeout" | "error" = /timed out/i.test(reason) ? "timeout" : "error";
    return { ok: false, kind, reason, taskId };
  }
}

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const {
    sessionId,
    description,
    style,
    images: b64Images = [],
    // For refinement: already-hosted image URLs from previous generation — no upload needed
    refineImageUrls = [] as string[],
    refinementText = "",
    selectedDesignNames = [] as string[],
    colors = [] as string[],
    count = 5,
  } = await req.json();

  if (!description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const isRefinement = refineImageUrls.length > 0 && refinementText.trim().length > 0;

  // ── Build input URL list ─────────────────────────────────────────────
  let inputUrls: string[] = [];

  if (isRefinement) {
    inputUrls = refineImageUrls as string[];

    if ((b64Images as string[]).length > 0) {
      try {
        const uploaded = await Promise.all(
          (b64Images as string[]).map((b64) => uploadBase64(b64, sessionId, "refs"))
        );
        inputUrls = [...inputUrls, ...uploaded];
      } catch (err) {
        return NextResponse.json(
          { error: `Image upload failed: ${(err as Error).message}` },
          { status: 500 }
        );
      }
    }
  } else if ((b64Images as string[]).length > 0) {
    try {
      inputUrls = await Promise.all(
        (b64Images as string[]).map((b64) => uploadBase64(b64, sessionId, "refs"))
      );
    } catch (err) {
      return NextResponse.json(
        { error: `Image upload failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  } else {
    // No reference images — placeholder so KEI has something to process
    inputUrls = ["https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Culinary_fruits_front_view.jpg/220px-Culinary_fruits_front_view.jpg"];
  }

  // ── Build prompt ─────────────────────────────────────────────────────
  let refinementInfo: RefinementInfo | undefined;
  if (isRefinement) {
    refinementInfo = {
      text: refinementText as string,
      selectedImages: (refineImageUrls as string[]).map((_, i) => ({
        name: (selectedDesignNames as string[])[i] ?? `Variation ${i + 1}`,
        index: i + 1,
      })),
    };
  }

  const hasUserRefs = (b64Images as string[]).length > 0;
  const prompt = buildTattooPrompt(
    description,
    style ?? "",
    hasUserRefs,
    refinementInfo,
    Array.isArray(colors) ? (colors as string[]) : []
  );

  // ── Fire tasks in parallel ───────────────────────────────────────────
  const initial = await Promise.all(Array.from({ length: count }, () => runOneTask(prompt, inputUrls)));

  // Retry only true model failures (moderation flake, transient KEI errors).
  // Timeouts mean KEI is congested — retrying just re-queues the same job and
  // eats the remaining budget. Run retries sequentially to avoid re-hitting
  // the concurrency cap that may have caused the first failure.
  const retried: RunResult[] = [];
  for (const r of initial) {
    if (r.ok) {
      retried.push(r);
      continue;
    }
    if (r.kind === "timeout") {
      console.warn(`[generate] task ${r.taskId ?? "?"} timed out — not retrying`);
      retried.push(r);
      continue;
    }
    console.warn(`[generate] task failed, retrying: ${r.reason}`);
    const second = await runOneTask(prompt, inputUrls);
    retried.push(second);
    if (!second.ok) {
      console.error(`[generate] retry also failed: ${second.reason}`);
    }
  }

  const successUrls = retried.filter((r): r is { ok: true; url: string } => r.ok).map((r) => r.url);
  const failures = retried.filter((r) => !r.ok) as Array<Extract<RunResult, { ok: false }>>;

  console.log("[generate] kei result URLs:", successUrls);
  if (failures.length > 0) {
    console.error(
      "[generate] permanent failures after retry:",
      failures.map((f) => ({ taskId: f.taskId, reason: f.reason, failCode: f.failCode }))
    );
  }

  if (successUrls.length === 0) {
    return NextResponse.json(
      {
        error: "All generation tasks failed",
        details: failures.map((f) => f.reason),
      },
      { status: 500 }
    );
  }

  // ── Migrate KEI tempfile URLs into Supabase Storage ──────────────────
  // Done with allSettled so one bad KEI URL doesn't kill the whole batch.
  const uploadResults = await Promise.allSettled(
    successUrls.map((url) => uploadFromUrl(url, sessionId, "designs"))
  );

  const stored: string[] = [];
  uploadResults.forEach((r, i) => {
    if (r.status === "fulfilled") {
      stored.push(r.value);
    } else {
      console.error(`[generate] upload failed for ${successUrls[i]}:`, r.reason?.message ?? r.reason);
    }
  });

  console.log("[generate] supabase stored URLs:", stored);

  if (stored.length === 0) {
    return NextResponse.json(
      {
        error: "Generated images couldn't be saved to storage",
        details: uploadResults
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .map((r) => (r.reason as Error)?.message),
      },
      { status: 500 }
    );
  }

  const generatedImages = stored.map((url, i) => ({
    id: `kei-${Date.now()}-${i}`,
    imageUrl: url,
  }));

  return NextResponse.json({
    images: generatedImages,
    requested: count,
    failures: failures.map((f) => f.reason),
  });
}
