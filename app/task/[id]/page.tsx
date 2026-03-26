import { redirect } from "next/navigation";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import ProofUpload from "./ProofUpload";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: assignedTask } = await supabase
    .from("assigned_tasks")
    .select(
      `
      id,
      completed,
      completed_at,
      task:tasks (
        id,
        title,
        description
      ),
      proofs (
        id,
        file_url,
        submitted_at
      )
    `
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assignedTask) {
    redirect("/dashboard");
  }

  const task = Array.isArray(assignedTask.task)
    ? assignedTask.task[0]
    : assignedTask.task;

  const proofs: { id: string; file_url: string | null; submitted_at: string | null }[] =
    (assignedTask.proofs ?? []) as any;

  function renderProof(url: string) {
    const lower = url.toLowerCase();
    const isVideo =
      lower.endsWith(".mp4") ||
      lower.endsWith(".webm") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".m4v");

    if (isVideo) {
      return (
        <video
          className="h-40 w-full rounded-lg bg-black object-cover"
          controls
          preload="metadata"
          src={url}
        />
      );
    }

    return (
      // Using <img> avoids Next/Image domain config for Supabase storage URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="h-40 w-full rounded-lg bg-zinc-700 object-cover"
        src={url}
        alt="Proof"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex-1 bg-zinc-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="text-sm text-zinc-400">Task</div>
            <h1 className="truncate text-2xl font-semibold text-zinc-100">
              {task?.title ?? "Untitled task"}
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 inline-flex items-center justify-center rounded-lg border bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Back
          </Link>
        </div>

        {task?.description ? (
          <div className="mt-5 rounded-2xl border bg-zinc-800 p-5 shadow-sm">
            <div className="text-sm font-semibold text-zinc-100">Description</div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
              {task.description}
            </p>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-zinc-100">Status</div>
            <div
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium",
                assignedTask.completed
                  ? "bg-emerald-900/30 text-emerald-300"
                  : "bg-zinc-700 text-zinc-300",
              ].join(" ")}
            >
              {assignedTask.completed ? "Completed" : "In progress"}
            </div>
          </div>
          {assignedTask.completed_at ? (
            <div className="mt-2 text-xs text-zinc-500">
              Completed at {new Date(assignedTask.completed_at).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <ProofUpload assignedTaskId={assignedTask.id} userId={user.id} />
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-zinc-100">Proofs</div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {proofs.length === 0 ? (
              <div className="rounded-2xl border bg-zinc-800 p-5 text-sm text-zinc-400 shadow-sm">
                No uploads yet.
              </div>
            ) : (
              proofs
                .filter((p) => p.file_url)
                .map((p) => (
                  <div key={p.id} className="rounded-2xl border bg-zinc-800 p-3 shadow-sm">
                    {renderProof(p.file_url!)}
                    <div className="mt-2 text-xs text-zinc-500">
                      {p.submitted_at
                        ? new Date(p.submitted_at).toLocaleString()
                        : ""}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

