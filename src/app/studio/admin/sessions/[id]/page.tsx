import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase-server";
import { resolveBackUrl } from "@/lib/auth-utils";
import SessionOverview from "@/components/session/SessionOverview";

export default async function AdminSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const staff = await getStaffSession();
  if (!staff) redirect("/studio/login");
  // Admin-only route — designers are blocked by middleware, this is the server-side guard
  if (staff.role !== "admin") redirect("/studio/designer");

  const { id } = await params;
  const { from } = await searchParams;

  const { backUrl, backLabel } = resolveBackUrl(from, staff.role, "/studio/admin", "Admin");

  return <SessionOverview sessionId={id} backUrl={backUrl} backLabel={backLabel} />;
}
