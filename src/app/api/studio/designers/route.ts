import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createServiceClient } from "@/lib/supabase-server";

// GET /api/studio/designers — list all staff (admin only)
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: requester } = await service.from("staff").select("role").eq("id", user.id).maybeSingle();
  if (requester?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await service
    .from("staff")
    .select("id, email, name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

// POST /api/studio/designers — create a new designer (admin only)
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: requester } = await service.from("staff").select("role").eq("id", user.id).maybeSingle();
  if (requester?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, name, password } = await req.json();
  if (!email?.trim() || !name?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "email, name and password are required" }, { status: 400 });
  }

  // Create auth user via Supabase Admin API
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 500 });
  }

  // Insert staff row
  const { data: staffRow, error: staffError } = await service
    .from("staff")
    .insert({ id: authData.user.id, email, name, role: "designer", is_active: true })
    .select()
    .single();

  if (staffError) {
    // Roll back auth user
    await service.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  return NextResponse.json({ staff: staffRow }, { status: 201 });
}

// PATCH /api/studio/designers — toggle is_active (admin only)
export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: requester } = await service.from("staff").select("role").eq("id", user.id).maybeSingle();
  if (requester?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Prevent admin from deactivating themselves
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
  }

  const { error } = await service.from("staff").update({ is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
