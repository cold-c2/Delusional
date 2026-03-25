"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminFromClaims } from "@/lib/auth/isAdmin";

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");
  const isAdmin = await isAdminFromClaims(supabase as any);
  if (!isAdmin) throw new Error("Not authorized");

  return { userId: user.id };
}

export async function createTaskAction(formData: FormData) {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) throw new Error("Title is required");

  const admin = createSupabaseAdminClient();

  const { data: activeRound, error: roundError } = await admin
    .from("game_rounds")
    .select("id")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError) throw new Error("Failed to load active round");
  if (!activeRound?.id) throw new Error("No active round");

  const { error } = await admin.from("tasks").insert({
    title,
    description: description || null,
    round_id: activeRound.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function startNewRoundAction(formData: FormData) {
  await assertAdmin();

  const roundNumberRaw = String(formData.get("round_number") ?? "").trim();
  const roundNumber = roundNumberRaw ? Number(roundNumberRaw) : null;

  const admin = createSupabaseAdminClient();

  const { error: deactivateError } = await admin
    .from("game_rounds")
    .update({ active: false })
    .eq("active", true);
  if (deactivateError) throw new Error(deactivateError.message);

  const { error: insertError } = await admin.from("game_rounds").insert({
    round_number: Number.isFinite(roundNumber as any) ? roundNumber : null,
    active: true,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

export async function assignTasksToAllUsersAction(formData: FormData) {
  await assertAdmin();

  const xRaw = String(formData.get("count") ?? "").trim();
  const count = Math.max(0, Math.min(1000, Number(xRaw || 0)));
  if (!Number.isFinite(count) || count <= 0) throw new Error("Count must be > 0");

  const admin = createSupabaseAdminClient();

  const { data: activeRound, error: roundError } = await admin
    .from("game_rounds")
    .select("id")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError) throw new Error("Failed to load active round");
  if (!activeRound?.id) throw new Error("No active round");

  const { data: tasks, error: tasksError } = await admin
    .from("tasks")
    .select("id")
    .eq("round_id", activeRound.id);
  if (tasksError) throw new Error(tasksError.message);

  const taskIds = (tasks ?? []).map((t) => t.id as string);
  if (taskIds.length === 0) throw new Error("No tasks available in active round");

  const { data: users, error: usersError } = await admin
    .from("profiles")
    .select("id");
  if (usersError) throw new Error(usersError.message);

  const userIds = (users ?? []).map((u) => u.id as string);
  if (userIds.length === 0) throw new Error("No users found (profiles table empty)");

  // Existing assignments for this round to avoid duplicates (best-effort).
  const { data: existing, error: existingError } = await admin
    .from("assigned_tasks")
    .select("user_id, task_id, task:tasks!inner(round_id)")
    .eq("task.round_id", activeRound.id);
  if (existingError) throw new Error(existingError.message);

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
    revalidatePath("/admin");
    return;
  }

  const { error: insertError } = await admin.from("assigned_tasks").insert(rowsToInsert);
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

