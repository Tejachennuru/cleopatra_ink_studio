import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const maxDuration = 300;

const BUCKET = "session-assets";
const SESSION_TTL_HOURS = 24;

// Deletes every file stored under `{sessionId}/` in the session-assets bucket.
// Returns the count of files removed.
async function deleteSessionStorage(
  supabase: ReturnType<typeof createServiceClient>,
  sessionId: string
): Promise<number> {
  // List all files recursively under the session folder.
  // Supabase Storage list() is flat per prefix — we list each known sub-folder.
  const prefixes = ["refs", "designs", "body", "composites", "previews"];
  const allPaths: string[] = [];

  for (const prefix of prefixes) {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${sessionId}/${prefix}`, { limit: 1000 });

    if (files && files.length > 0) {
      files.forEach((f) => allPaths.push(`${sessionId}/${prefix}/${f.name}`));
    }
  }

  if (allPaths.length === 0) return 0;

  const { error } = await supabase.storage.from(BUCKET).remove(allPaths);
  if (error) {
    console.error(`[cleanup] Storage delete failed for session ${sessionId}:`, error.message);
  }

  return allPaths.length;
}

export async function GET(req: NextRequest) {
  // Verify the request is from our cron runner (Vercel passes this automatically,
  // or it can be called manually with the header).
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Find all active sessions older than the TTL
  const { data: expiredSessions, error: queryError } = await supabase
    .from("sessions")
    .select("id")
    .eq("status", "active")
    .lt("created_at", cutoff);

  if (queryError) {
    console.error("[cleanup] Failed to query expired sessions:", queryError.message);
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  if (!expiredSessions || expiredSessions.length === 0) {
    console.log("[cleanup] No expired sessions found.");
    return NextResponse.json({ cleaned: 0, filesRemoved: 0 });
  }

  console.log(`[cleanup] Found ${expiredSessions.length} expired session(s) to remove.`);

  let totalFilesRemoved = 0;
  const cleaned: string[] = [];
  const failed: string[] = [];

  for (const session of expiredSessions) {
    try {
      // 1. Delete storage files
      const filesRemoved = await deleteSessionStorage(supabase, session.id);
      totalFilesRemoved += filesRemoved;

      // 2. Delete the session row — cascades to tattoo_designs and placements
      const { error: deleteError } = await supabase
        .from("sessions")
        .delete()
        .eq("id", session.id);

      if (deleteError) throw new Error(deleteError.message);

      cleaned.push(session.id);
      console.log(`[cleanup] Session ${session.id} removed (${filesRemoved} files).`);
    } catch (err) {
      failed.push(session.id);
      console.error(`[cleanup] Failed to remove session ${session.id}:`, (err as Error).message);
    }
  }

  return NextResponse.json({
    cleaned: cleaned.length,
    failed: failed.length,
    filesRemoved: totalFilesRemoved,
    sessionIds: cleaned,
    ...(failed.length > 0 && { failedIds: failed }),
  });
}
