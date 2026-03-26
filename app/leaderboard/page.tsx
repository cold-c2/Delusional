import { redirect } from "next/navigation";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ActiveRound = {
  id: string;
  round_number: number | null;
  created_at: string | null;
};

type AssignedTaskRow = {
  user_id: string;
  task_id: string;
  completed: boolean | null;
  completed_at: string | null;
  task:
    | {
        round_id: string | null;
      }
    | { round_id: string | null }[]
    | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
};

export default async function LeaderboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: activeRound } = await supabase
    .from("game_rounds")
    .select("id, round_number, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ActiveRound>();

  if (!activeRound?.id) {
    return (
      <div className="flex-1 bg-zinc-900">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold text-zinc-100">Leaderboard</h1>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Back
            </Link>
          </div>
          <div className="mt-6 rounded-2xl border bg-zinc-800 p-6 shadow-sm">
            <p className="text-sm text-zinc-400">No active round.</p>
          </div>
        </div>
      </div>
    );
  }

  const { data: assignedTasksRaw } = await supabase
    .from("assigned_tasks")
    .select("user_id, task_id, completed, completed_at, task:tasks!inner(round_id)")
    .eq("task.round_id", activeRound.id)
    .returns<any[]>();

  const assignedTasks = (assignedTasksRaw ?? []) as unknown as AssignedTaskRow[];

  const byUser = new Map<
    string,
    { total: number; completed: number; maxCompletedAt: number | null }
  >();

  for (const row of assignedTasks) {
    const entry =
      byUser.get(row.user_id) ?? { total: 0, completed: 0, maxCompletedAt: null };
    entry.total += 1;

    if (row.completed) {
      entry.completed += 1;
      if (row.completed_at) {
        const t = new Date(row.completed_at).getTime();
        if (!Number.isNaN(t)) {
          entry.maxCompletedAt = entry.maxCompletedAt === null ? t : Math.max(entry.maxCompletedAt, t);
        }
      }
    }

    byUser.set(row.user_id, entry);
  }

  const userIds = Array.from(byUser.keys());
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds)
    .returns<ProfileRow[]>();

  const profileById = new Map<string, ProfileRow>();
  for (const p of profilesRaw ?? []) profileById.set(p.id, p);

  const entries = userIds.map((userId) => {
    const stats = byUser.get(userId)!;
    const finished = stats.total > 0 && stats.completed === stats.total;
    const completionTime = finished ? stats.maxCompletedAt : null;
    const username = profileById.get(userId)?.username ?? null;

    return {
      userId,
      username,
      total: stats.total,
      completed: stats.completed,
      finished,
      completionTime,
    };
  });

  entries.sort((a, b) => {
    // Finished users first, by completion time asc
    if (a.finished && b.finished) {
      return (a.completionTime ?? Infinity) - (b.completionTime ?? Infinity);
    }
    if (a.finished !== b.finished) return a.finished ? -1 : 1;

    // Incomplete users next, by completed desc
    if (a.completed !== b.completed) return b.completed - a.completed;

    // Stable-ish tie-breakers
    if (a.total !== b.total) return b.total - a.total;
    return a.userId.localeCompare(b.userId);
  });

  const winnerUserId = entries[0]?.userId ?? null;

  return (
    <div className="flex-1 bg-zinc-900">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Leaderboard</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Round {activeRound.round_number ?? ""}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-zinc-800 shadow-sm">
          <div className="grid grid-cols-12 gap-4 border-b bg-zinc-700/50 px-4 py-3 text-xs font-medium text-zinc-400 sm:px-5">
            <div className="col-span-5">Player</div>
            <div className="col-span-5">Progress</div>
            <div className="col-span-2 text-right">Score</div>
          </div>

          {entries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400 sm:px-5">
              No assigned tasks found for this round.
            </div>
          ) : (
            entries.map((e, idx) => {
              const percent =
                e.total === 0 ? 0 : Math.round((e.completed / e.total) * 100);
              const isWinner = winnerUserId === e.userId;

              return (
                <div
                  key={e.userId}
                  className="grid grid-cols-12 gap-4 px-4 py-4 items-center border-b last:border-b-0 sm:px-5"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {e.username ?? e.userId}
                      </div>
                      {isWinner ? (
                        <span className="text-base" aria-label="winner">
                          👑
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {e.finished
                        ? "Finished"
                        : `Rank ${idx + 1}`}
                    </div>
                  </div>

                  <div className="col-span-5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <div>
                        {e.completed} / {e.total}
                      </div>
                      <div className="tabular-nums">{percent}%</div>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className={[
                          "h-full rounded-full transition-[width]",
                          e.finished ? "bg-emerald-600" : "bg-zinc-400",
                        ].join(" ")}
                        style={{ width: `${percent}%` }}
                        aria-label="Progress bar"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-sm font-semibold text-zinc-100 tabular-nums">
                      {e.completed}
                    </div>
                    {e.finished && e.completionTime ? (
                      <div className="mt-1 text-xs text-zinc-500">
                        {new Date(e.completionTime).toLocaleTimeString()}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

