import { redirect } from "next/navigation";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ActiveRound = {
  id: string;
  round_number: number | null;
  active: boolean | null;
  created_at: string | null;
};

type AssignedTaskRow = {
  id: string;
  completed: boolean | null;
  completed_at: string | null;
  task:
    | {
        id: string;
        title: string | null;
        description: string | null;
        round_id: string | null;
      }
    | {
        id: string;
        title: string | null;
        description: string | null;
        round_id: string | null;
      }[]
    | null;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: activeRound } = await supabase
    .from("game_rounds")
    .select("id, round_number, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ActiveRound>();

  // Fetch assigned tasks for the logged-in user.
  // If an active round exists, scope tasks to that round.
  let assignedTasksQuery = supabase
    .from("assigned_tasks")
    .select(
      "id, completed, completed_at, task:tasks(id, title, description, round_id)"
    )
    .eq("user_id", user.id)
    .order("completed", { ascending: true });

  if (activeRound?.id) {
    assignedTasksQuery = assignedTasksQuery.eq("task.round_id", activeRound.id);
  }

  const { data: assignedTasksRaw } = await assignedTasksQuery;
  const assignedTasks = (assignedTasksRaw ?? []) as unknown as AssignedTaskRow[];
  const tasks = assignedTasks
    .map((row) => {
      const task = Array.isArray(row.task) ? row.task[0] : row.task;
      return { ...row, task };
    })
    .filter((t) => t.task);

  const total = tasks.length;
  const completed = tasks.reduce(
    (acc, t) => acc + (t.completed ? 1 : 0),
    0
  );
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;

  return (
    <div className="flex-1 bg-zinc-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-600">
            {activeRound?.id
              ? `Round ${activeRound.round_number ?? ""}`.trim()
              : "No active round"}
          </p>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-900">Progress</div>
              <div className="text-sm text-zinc-600">
                {completed} / {total} completed
              </div>
            </div>
            <div className="text-sm font-medium tabular-nums text-zinc-900">
              {percent}%
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width]"
              style={{ width: `${percent}%` }}
              aria-label="Progress bar"
            />
          </div>
        </div>

        {allDone ? (
          <div className="mt-6 rounded-2xl border bg-emerald-50 p-6">
            <div className="text-xl font-semibold text-emerald-900">
              You finished! Check the leaderboard.
            </div>
            <div className="mt-3">
              <Link
                href="/leaderboard"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Go to leaderboard
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <div className="text-sm font-medium text-zinc-900">Your tasks</div>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {tasks.length === 0 ? (
              <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">
                No tasks assigned{activeRound?.id ? " for this round" : ""}.
              </div>
            ) : (
              tasks.map((row) => {
                const task = row.task!;
                const done = Boolean(row.completed);

                return (
                  <div
                    key={row.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-zinc-900">
                          {task.title ?? "Untitled task"}
                        </div>
                        {task.description ? (
                          <div className="mt-1 line-clamp-3 text-sm text-zinc-600">
                            {task.description}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={[
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                          done
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-700",
                        ].join(" ")}
                      >
                        {done ? "Completed" : "In progress"}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={`/task/${row.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                      >
                        Open task
                      </Link>

                      <div className="text-xs text-zinc-500">
                        {row.completed_at ? "Completed" : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

