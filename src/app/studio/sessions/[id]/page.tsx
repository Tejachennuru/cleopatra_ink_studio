import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase-server";
import { resolveBackUrl } from "@/lib/auth-utils";
import SessionOverview from "@/components/session/SessionOverview";

export default async function DesignerSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const staff = await getStaffSession();
  if (!staff) redirect("/studio/login");

  const { id } = await params;
  const { from } = await searchParams;

  const defaultUrl = staff.role === "admin" ? "/studio/admin" : "/studio/designer";
  const defaultLabel = staff.role === "admin" ? "Admin" : "Dashboard";
  const { backUrl, backLabel } = resolveBackUrl(from, staff.role, defaultUrl, defaultLabel);

  return <SessionOverview sessionId={id} backUrl={backUrl} backLabel={backLabel} />;
}
