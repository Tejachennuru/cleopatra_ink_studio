import { NextRequest } from "next/server";
import { buildTattooPrompt, createKeiTask, waitForKeiTask, KeiTaskFailedError } from "@/lib/kei-api";
import type { RefinementInfo } from "@/lib/kei-api";
import { uploadBase64, uploadFromUrl } from "@/lib/storage";

type RunResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; taskId?: string };

async function runOneTask(prompt: string, inputUrls: string[]): Promise<RunResult> {
  let taskId: string | undefined;
  try {
    taskId = await createKeiTask(prompt, inputUrls);
    const url = await waitForKeiTask(taskId);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof KeiTaskFailedError) {
      return { ok: false, reason: err.failMsg ?? "Unknown KEI failure", taskId: err.taskId };
    }
    return { ok: false, reason: (err as Error).message, taskId };
  }
}

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const {
    sessionId,
    description,
    style,
    images: b64Images = [],
    refineImageUrls = [] as string[],
    refinementText = "",
    selectedDesignNames = [] as string[],
    colors = [] as string[],
    count = 5,
  } = await req.json();

  if (!description?.trim()) {
    return Response.json({ error: "description is required" }, { status: 400 });
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
        return Response.json({ error: `Image upload failed: ${(err as Error).message}` }, { status: 500 });
      }
    }
  } else if ((b64Images as string[]).length > 0) {
    try {
      inputUrls = await Promise.all(
        (b64Images as string[]).map((b64) => uploadBase64(b64, sessionId, "refs"))
      );
    } catch (err) {
      return Response.json({ error: `Image upload failed: ${(err as Error).message}` }, { status: 500 });
    }
  } else {
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

  // ── Stream results as each task completes ────────────────────────────
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const emit = (event: object) =>
    writer.write(encoder.encode(JSON.stringify(event) + "\n"));

  (async () => {
    const tasks = Array.from({ length: count }, (_, index) =>
      runOneTask(prompt, inputUrls)
        .then(async (result) => {
          if (!result.ok) {
            console.warn(`[generate] task ${index} failed: ${result.reason}`);
            await emit({ type: "error", index, reason: result.reason });
            return;
          }
          try {
            const url = await uploadFromUrl(result.url, sessionId, "designs");
            await emit({
              type: "result",
              index,
              image: { id: `kei-${Date.now()}-${index}`, imageUrl: url },
            });
          } catch (err) {
            console.error(`[generate] storage upload failed for task ${index}:`, err);
            await emit({ type: "error", index, reason: `Image upload failed: ${(err as Error).message}` });
          }
        })
        .catch(async (err) => {
          await emit({ type: "error", index, reason: (err as Error).message });
        })
    );

    await Promise.allSettled(tasks);
    await emit({ type: "done" });
    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
