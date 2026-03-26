import Link from "next/link";

type ProofGroup = {
  userId: string;
  username: string | null;
  tasks: {
    assignedTaskId: string;
    taskTitle: string | null;
    proofs: { id: string; file_url: string | null; submitted_at: string | null }[];
  }[];
};

function renderProofThumb(url: string) {
  const lower = url.toLowerCase();
  const isVideo =
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v");

  if (isVideo) {
    return (
      <video
        className="h-20 w-28 rounded bg-black object-cover"
        src={url}
        preload="metadata"
        controls
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img className="h-20 w-28 rounded bg-zinc-700 object-cover" src={url} alt="Proof" />;
}

export default function ProofsTable({ groups }: { groups: ProofGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border bg-zinc-800 p-5 text-sm text-zinc-400 shadow-sm">
        No proofs yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.userId} className="overflow-hidden rounded-2xl border bg-zinc-800 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b bg-zinc-700/50 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-100">
                {g.username ?? g.userId}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">{g.userId}</div>
            </div>
          </div>

          <div className="divide-y">
            {g.tasks.map((t) => (
              <div key={t.assignedTaskId} className="px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">
                      {t.taskTitle ?? "Untitled task"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Assigned task:{" "}
                      <Link
                        className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300"
                        href={`/task/${t.assignedTaskId}`}
                      >
                        {t.assignedTaskId}
                      </Link>
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-400 tabular-nums">
                    {t.proofs.length} proof{t.proofs.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {t.proofs
                    .filter((p) => p.file_url)
                    .map((p) => (
                      <div key={p.id} className="flex flex-col gap-1">
                        {renderProofThumb(p.file_url!)}
                        <div className="w-28 truncate text-[11px] text-zinc-400">
                          {p.submitted_at
                            ? new Date(p.submitted_at).toLocaleString()
                            : ""}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

