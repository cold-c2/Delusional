import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActiveRound = { id: string; round_number: number | null; created_at: string | null };

export const runtime = "edge";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { data: activeRound, error: roundError } = await supabase
      .from("game_rounds")
      .select("id, round_number, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ActiveRound>();

    if (roundError) {
      return NextResponse.json(
        { error: { message: roundError.message } },
        { status: 500 }
      );
    }
    if (!activeRound?.id) {
      return NextResponse.json({ data: { round: null, entries: [] } });
    }

    const { data: assignedTasksRaw, error: assignedError } = await supabase
      .from("assigned_tasks")
      .select("user_id, completed, completed_at, task:tasks!inner(round_id)")
      .eq("task.round_id", activeRound.id);

    if (assignedError) {
      return NextResponse.json(
        { error: { message: assignedError.message } },
        { status: 500 }
      );
    }

    const byUser = new Map<
      string,
      { total: number; completed: number; maxCompletedAt: number | null }
    >();

    for (const row of assignedTasksRaw ?? []) {
      const uid = (row as any).user_id as string;
      const completed = Boolean((row as any).completed);
      const completedAt = (row as any).completed_at as string | null;

      const entry = byUser.get(uid) ?? { total: 0, completed: 0, maxCompletedAt: null };
      entry.total += 1;
      if (completed) {
        entry.completed += 1;
        if (completedAt) {
          const t = new Date(completedAt).getTime();
          if (!Number.isNaN(t)) {
            entry.maxCompletedAt = entry.maxCompletedAt === null ? t : Math.max(entry.maxCompletedAt, t);
          }
        }
      }
      byUser.set(uid, entry);
    }

    const userIds = Array.from(byUser.keys());
    const { data: profiles } =
      userIds.length > 0
        ? await supabase.from("profiles").select("id, username").in("id", userIds)
        : { data: [] as any[] };

    const profileById = new Map<string, { username: string | null }>();
    for (const p of profiles ?? []) profileById.set(p.id, { username: p.username });

    const entries = userIds.map((userId) => {
      const stats = byUser.get(userId)!;
      const finished = stats.total > 0 && stats.completed === stats.total;
      const completionTime = finished ? stats.maxCompletedAt : null;

      return {
        userId,
        username: profileById.get(userId)?.username ?? null,
        completed: stats.completed,
        total: stats.total,
        finished,
        completionTime,
      };
    });

    entries.sort((a, b) => {
      if (a.finished && b.finished) {
        return (a.completionTime ?? Infinity) - (b.completionTime ?? Infinity);
      }
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.completed !== b.completed) return b.completed - a.completed;
      if (a.total !== b.total) return b.total - a.total;
      return a.userId.localeCompare(b.userId);
    });

    return NextResponse.json({
      data: {
        round: { id: activeRound.id, round_number: activeRound.round_number },
        entries,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

