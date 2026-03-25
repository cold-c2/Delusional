import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminFromClaims } from "@/lib/auth/isAdmin";

import {
  assignTasksToAllUsersAction,
  createTaskAction,
  startNewRoundAction,
} from "./actions";
import ProofsTable from "./ProofsTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await isAdminFromClaims(supabase as any);
  if (!isAdmin) redirect("/dashboard");

  const admin = createSupabaseAdminClient();

  const { data: activeRound } = await admin
    .from("game_rounds")
    .select("id, round_number, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, round_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: proofsRows } = await admin
    .from("proofs")
    .select(
      `
      id,
      file_url,
      submitted_at,
      assigned_task:assigned_tasks (
        id,
        user_id,
        task:tasks (
          id,
          title
        )
      )
    `
    )
    .order("submitted_at", { ascending: false })
    .limit(200);

  const userIds = Array.from(
    new Set(
      (proofsRows ?? [])
        .map((p: any) => p.assigned_task?.user_id as string | undefined)
        .filter(Boolean) as string[]
    )
  );

  const { data: profiles } =
    userIds.length > 0
      ? await admin.from("profiles").select("id, username").in("id", userIds)
      : { data: [] as any[] };

  const profileById = new Map<string, { id: string; username: string | null }>();
  for (const p of profiles ?? []) profileById.set(p.id, p);

  const grouped = new Map<
    string,
    Map<string, { assignedTaskId: string; taskTitle: string | null; proofs: any[] }>
  >();

  for (const p of proofsRows ?? []) {
    const assigned = (p as any).assigned_task;
    if (!assigned?.user_id) continue;
    const uid = assigned.user_id as string;
    const assignedTaskId = assigned.id as string;
    const taskTitle =
      Array.isArray(assigned.task) ? assigned.task[0]?.title : assigned.task?.title;

    if (!grouped.has(uid)) grouped.set(uid, new Map());
    const byTask = grouped.get(uid)!;
    if (!byTask.has(assignedTaskId)) {
      byTask.set(assignedTaskId, { assignedTaskId, taskTitle: taskTitle ?? null, proofs: [] });
    }
    byTask.get(assignedTaskId)!.proofs.push({
      id: (p as any).id,
      file_url: (p as any).file_url,
      submitted_at: (p as any).submitted_at,
    });
  }

  const proofGroups = Array.from(grouped.entries()).map(([uid, byTask]) => ({
    userId: uid,
    username: profileById.get(uid)?.username ?? null,
    tasks: Array.from(byTask.values()),
  }));

  return (
    <div className="flex-1 bg-zinc-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Active round:{" "}
              <span className="font-medium text-zinc-900">
                {activeRound?.id
                  ? `#${activeRound.round_number ?? ""}`.trim() || "Active"
                  : "None"}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">Start new round</div>
            <form action={startNewRoundAction} className="mt-4 flex gap-3">
              <input
                name="round_number"
                placeholder="Round # (optional)"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                Start
              </button>
            </form>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">Assign tasks to all users</div>
            <form action={assignTasksToAllUsersAction} className="mt-4 flex gap-3">
              <input
                name="count"
                type="number"
                min={1}
                step={1}
                placeholder="X tasks per user"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                required
              />
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                Assign
              </button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">
              Uses `profiles` as the list of users. Skips tasks already assigned in the active round.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm lg:col-span-2">
            <div className="text-sm font-semibold text-zinc-900">Create a task (active round)</div>
            <form action={createTaskAction} className="mt-4 grid grid-cols-1 gap-3">
              <input
                name="title"
                placeholder="Title"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                required
              />
              <textarea
                name="description"
                placeholder="Description"
                className="min-h-28 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <div>
                <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                  Create task
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-10">
          <div className="text-sm font-semibold text-zinc-900">Recent tasks</div>
          <div className="mt-3 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 border-b bg-zinc-50 px-4 py-3 text-xs font-medium text-zinc-600 sm:px-5">
              <div className="col-span-7">Title</div>
              <div className="col-span-3">Round</div>
              <div className="col-span-2 text-right">Created</div>
            </div>
            {(tasks ?? []).length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-600 sm:px-5">No tasks.</div>
            ) : (
              (tasks ?? []).map((t: any) => (
                <div
                  key={t.id}
                  className="grid grid-cols-12 gap-4 border-b last:border-b-0 px-4 py-4 text-sm sm:px-5"
                >
                  <div className="col-span-7 truncate font-medium text-zinc-900">
                    {t.title ?? "Untitled"}
                  </div>
                  <div className="col-span-3 text-zinc-600 truncate">
                    {t.round_id === activeRound?.id ? "Active" : t.round_id}
                  </div>
                  <div className="col-span-2 text-right text-zinc-500 text-xs">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10">
          <div className="text-sm font-semibold text-zinc-900">Proof uploads</div>
          <div className="mt-3">
            <ProofsTable groups={proofGroups as any} />
          </div>
        </div>
      </div>
    </div>
  );
}

