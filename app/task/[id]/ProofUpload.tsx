"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  assignedTaskId: string;
  userId: string;
};

export default function ProofUpload({ assignedTaskId, userId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const objectName = crypto.randomUUID();
      const storagePath = `${userId}/${assignedTaskId}/${objectName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("task-proofs")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("task-proofs")
        .getPublicUrl(storagePath);

      const fileUrl = publicData.publicUrl;

      const { error: proofError } = await supabase.from("proofs").insert({
        assigned_task_id: assignedTaskId,
        file_url: fileUrl,
      });
      if (proofError) throw proofError;

      const { error: completeError } = await supabase
        .from("assigned_tasks")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", assignedTaskId)
        .eq("user_id", userId);
      if (completeError) throw completeError;

      router.refresh();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Upload failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
      setDragOver(false);
    }
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Please upload an image or video file.");
      return;
    }

    await handleFile(file);
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Upload proof</div>
          <div className="mt-1 text-sm text-zinc-600">
        Upload an image or video. This will mark the task complete.
          </div>
        </div>
        {loading ? (
          <div className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
            Uploading…
          </div>
        ) : null}
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={[
          "mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
          dragOver
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-200 bg-white hover:bg-zinc-50/50",
        ].join(" ")}
      >
        <div className="text-sm font-medium text-zinc-900">
          Drag & drop a file here, or choose one.
        </div>
        <div className="mt-1 text-xs text-zinc-600">PNG/JPG/GIF or MP4/WebM</div>

        <div className="mt-4">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              disabled={loading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                await handleFile(file);
              }}
            />
            {loading ? "Uploading..." : "Choose file"}
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

