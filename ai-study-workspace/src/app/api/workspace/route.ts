import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return { supabase: null, userId: null };
  return { supabase, userId: data.claims.sub };
}

export async function GET() {
  try {
    const { supabase, userId } = await authenticatedClient();
    if (!supabase || !userId) return NextResponse.json({ error: "Sign in to access your workspace." }, { status: 401 });
    const { data, error } = await supabase.from("user_workspaces").select("data").eq("user_id", userId).maybeSingle();
    if (error) return NextResponse.json({ error: "Could not load your private workspace." }, { status: 500 });
    return NextResponse.json({ found: Boolean(data), workspace: data?.data ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Workspace storage is unavailable. Check your Supabase configuration and migration." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, userId } = await authenticatedClient();
    if (!supabase || !userId) return NextResponse.json({ error: "Sign in to save your workspace." }, { status: 401 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_000_000) return NextResponse.json({ error: "Workspace data is too large to sync." }, { status: 413 });
    const input = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (!Array.isArray(input.courses) || !Array.isArray(input.reviewProgress) || !Array.isArray(input.deletedCourseIds) || typeof input.deletedMaterialIds !== "object" || input.deletedMaterialIds === null || Array.isArray(input.deletedMaterialIds)) {
      return NextResponse.json({ error: "Workspace data has an invalid format." }, { status: 400 });
    }
    if (input.courses.length > 200 || input.reviewProgress.length > 10000) return NextResponse.json({ error: "Workspace has reached its current size limit." }, { status: 413 });
    const workspace: WorkspaceSnapshot = {
      courses: input.courses as WorkspaceSnapshot["courses"],
      reviewProgress: input.reviewProgress as WorkspaceSnapshot["reviewProgress"],
      deletedCourseIds: input.deletedCourseIds.filter((id): id is string => typeof id === "string"),
      deletedMaterialIds: input.deletedMaterialIds as Record<string, string[]>,
    };
    const { error } = await supabase.from("user_workspaces").upsert({ user_id: userId, data: workspace, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Could not save your private workspace." }, { status: 500 });
    return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Workspace storage is unavailable. Check your Supabase configuration and migration." }, { status: 503 });
  }
}
