import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminFromClaims } from "@/lib/auth/isAdmin";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const isAdmin = await isAdminFromClaims(supabase as any);
    if (!isAdmin) {
      return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    const descriptionRaw = body?.description;
    const description =
      descriptionRaw === undefined || descriptionRaw === null
        ? null
        : String(descriptionRaw).trim();

    if (!title) {
      return NextResponse.json(
        { error: { message: "title is required" } },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: activeRound, error: roundError } = await admin
      .from("game_rounds")
      .select("id")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) {
      return NextResponse.json(
        { error: { message: roundError.message } },
        { status: 500 }
      );
    }
    if (!activeRound?.id) {
      return NextResponse.json(
        { error: { message: "No active round" } },
        { status: 400 }
      );
    }

    const { data: task, error: insertError } = await admin
      .from("tasks")
      .insert({
        title,
        description: description || null,
        round_id: activeRound.id,
      })
      .select("id, title, description, round_id, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: { message: insertError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

