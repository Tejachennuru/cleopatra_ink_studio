import { createServiceClient } from "./supabase-server";

const BUCKET = "session-assets";

function makePath(sessionId: string | undefined, prefix: string, ext = "jpg") {
  const session = sessionId || "anon";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${session}/${prefix}/${stamp}.${ext}`;
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/** Upload a base64-encoded image (with or without data-URI prefix) to Supabase Storage. */
export async function uploadBase64(
  base64Data: string,
  sessionId: string | undefined,
  prefix: string
): Promise<string> {
  const match = base64Data.match(/^data:([^;]+);base64,/);
  const contentType = match?.[1] ?? "image/jpeg";
  const pureBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(pureBase64, "base64");
  const ext = extFromContentType(contentType);
  const path = makePath(sessionId, prefix, ext);

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Fetch a remote URL (e.g. KEI tempfile) and re-upload it to Supabase Storage. */
export async function uploadFromUrl(
  sourceUrl: string,
  sessionId: string | undefined,
  prefix: string
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = extFromContentType(contentType);
  const path = makePath(sessionId, prefix, ext);

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
