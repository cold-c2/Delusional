import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminFromClaims } from "@/lib/auth/isAdmin";

export const runtime = "edge";

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    const count = Number(body?.count);

    if (!Number.isFinite(count) || count <= 0) {
      return NextResponse.json(
        { error: { message: "count must be a number > 0" } },
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

    const { data: tasks, error: tasksError } = await admin
      .from("tasks")
      .select("id")
      .eq("round_id", activeRound.id);
    if (tasksError) {
      return NextResponse.json(
        { error: { message: tasksError.message } },
        { status: 500 }
      );
    }
    const taskIds = (tasks ?? []).map((t: any) => t.id as string);
    if (taskIds.length === 0) {
      return NextResponse.json(
        { error: { message: "No tasks available in active round" } },
        { status: 400 }
      );
    }

    const { data: users, error: usersError } = await admin
      .from("profiles")
      .select("id");
    if (usersError) {
      return NextResponse.json(
        { error: { message: usersError.message } },
        { status: 500 }
      );
    }
    const userIds = (users ?? []).map((u: any) => u.id as string);
    if (userIds.length === 0) {
      return NextResponse.json(
        { error: { message: "No users found (profiles table empty)" } },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("assigned_tasks")
      .select("user_id, task_id, task:tasks!inner(round_id)")
      .eq("task.round_id", activeRound.id);
    if (existingError) {
      return NextResponse.json(
        { error: { message: existingError.message } },
        { status: 500 }
      );
    }

    const existingByUser = new Map<string, Set<string>>();
    for (const row of existing ?? []) {
      const uid = (row as any).user_id as string;
      const tid = (row as any).task_id as string;
      if (!existingByUser.has(uid)) existingByUser.set(uid, new Set());
      existingByUser.get(uid)!.add(tid);
    }

    const rowsToInsert: { user_id: string; task_id: string }[] = [];
    for (const uid of userIds) {
      const taken = existingByUser.get(uid) ?? new Set<string>();
      const available = taskIds.filter((id) => !taken.has(id));
      const pick = shuffle(available).slice(0, Math.min(count, available.length));
      for (const tid of pick) rowsToInsert.push({ user_id: uid, task_id: tid });
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ data: { inserted: 0 } });
    }

    const { error: insertError } = await admin.from("assigned_tasks").insert(rowsToInsert);
    if (insertError) {
      return NextResponse.json(
        { error: { message: insertError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { inserted: rowsToInsert.length } }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

