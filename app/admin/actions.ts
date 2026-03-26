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

  // Deactivate all previous rounds
  const { error: deactivateError } = await admin
    .from("game_rounds")
    .update({ active: false })
    .eq("active", true);
  if (deactivateError) throw new Error(deactivateError.message);

  // Create new round
  const { data: newRound, error: insertError } = await admin.from("game_rounds").insert({
    round_number: Number.isFinite(roundNumber as any) ? roundNumber : null,
    active: true,
  }).select().single();
  if (insertError) throw new Error(insertError.message);

  // Auto-create balanced task pool
  const taskPool = [
    // Movement Tasks (10)
    { title: "Take a photo near a vending machine", description: "Find a vending machine and take a photo next to it.", category: "movement" },
    { title: "Take a photo next to a staircase", description: "Stand near a staircase and take a photo.", category: "movement" },
    { title: "Take a photo near lockers", description: "Find lockers and take a photo next to them.", category: "movement" },
    { title: "Take a photo near a water fountain", description: "Locate a water fountain and take a photo.", category: "movement" },
    { title: "Take a photo in a hallway corner", description: "Find a corner in a hallway and take a photo.", category: "movement" },
    { title: "Take a photo outside a classroom door", description: "Stand outside any classroom door and take a photo.", category: "movement" },
    { title: "Take a photo next to a bulletin board", description: "Find a bulletin board and take a photo next to it.", category: "movement" },
    { title: "Take a photo near an exit sign", description: "Locate an exit sign and take a photo.", category: "movement" },
    { title: "Take a photo somewhere with a window view", description: "Find a spot with a window and take a photo.", category: "movement" },
    { title: "Take photos from two different classrooms", description: "Take one photo in each of two different classrooms (counts as 1 task).", category: "movement" },
    
    // Observation Tasks (10)
    { title: "Find a number higher than 200", description: "Find and photograph any number greater than 200.", category: "observation" },
    { title: "Find something reflective", description: "Find and photograph something that reflects light.", category: "observation" },
    { title: "Find something with exactly 5 letters on it", description: "Find text with exactly 5 letters and photograph it.", category: "observation" },
    { title: "Find something red and blue together", description: "Find something that has both red and blue colors.", category: "observation" },
    { title: "Find something shaped like a triangle", description: "Find and photograph something triangular.", category: "observation" },
    { title: "Find something written in marker", description: "Find text written with marker and photograph it.", category: "observation" },
    { title: "Find something posted on a wall today", description: "Find something that was put on a wall today.", category: "observation" },
    { title: "Find something with the letter Q", description: "Find text or object containing the letter Q.", category: "observation" },
    { title: "Find a clock showing a new hour", description: "Find a clock that just changed to a new hour.", category: "observation" },
    { title: "Find a sign with multiple arrows", description: "Find a sign that has multiple directional arrows.", category: "observation" },
    
    // Social Tasks (10)
    { title: "Get someone to write a word on paper for you", description: "Ask someone to write any word on paper and photograph it.", category: "social" },
    { title: "Ask someone for time and record answer", description: "Ask someone the time and record their response.", category: "social" },
    { title: "Borrow a pencil and return it later", description: "Borrow a pencil, take photo, then return it (2 photos total).", category: "social" },
    { title: "Get someone to say 'good luck' on video", description: "Record someone saying 'good luck' for you.", category: "social" },
    { title: "Have someone draw a star on paper for you", description: "Ask someone to draw a star and photograph it.", category: "social" },
    { title: "Take a photo with someone holding a book", description: "Take a photo with someone who is holding a book.", category: "social" },
    { title: "Have someone hand you an object on camera", description: "Record someone handing you an object.", category: "social" },
    { title: "Take a photo with someone wearing headphones", description: "Find someone wearing headphones and take a photo together.", category: "social" },
    { title: "Get someone to point at the camera", description: "Ask someone to point directly at your camera.", category: "social" },
    { title: "Have someone say your name on video", description: "Record someone saying your name.", category: "social" },
    
    // Weird Behavior Tasks (10)
    { title: "Stand near a door for 10 seconds", description: "Stand near any door for exactly 10 seconds (video proof).", category: "weird" },
    { title: "Look at the ceiling for 5 seconds", description: "Look up at the ceiling for 5 seconds (video proof).", category: "weird" },
    { title: "Turn around slowly in a hallway", description: "Do a slow 360° turn in a hallway (video proof).", category: "weird" },
    { title: "Walk to end of hallway and back", description: "Walk to end of hallway and back (2 photos - start and end).", category: "weird" },
    { title: "Point at something random and nod", description: "Point at something random, then nod (video proof).", category: "weird" },
    { title: "Sit somewhere different than usual", description: "Sit in an unusual spot for you and take a photo.", category: "weird" },
    { title: "Walk past same spot twice", description: "Walk past the same spot twice, taking both photos.", category: "weird" },
    { title: "Tap a desk twice and record it", description: "Tap a desk exactly twice and record it.", category: "weird" },
    { title: "Look behind you suddenly on camera", description: "Suddenly look behind you (video proof).", category: "weird" },
    { title: "Walk backwards 5 steps safely", description: "Walk backwards 5 steps safely (video proof).", category: "weird" },
  ];

  // Insert all tasks for the new round
  const { error: tasksError } = await admin
    .from("tasks")
    .insert(taskPool.map(task => ({
      title: task.title,
      description: task.description,
      round_id: newRound.id,
    })));
  if (tasksError) throw new Error(tasksError.message);

  // Auto-assign 5 tasks per user (2 movement, 1 observation, 1 social, 1 weird)
  await assignBalancedTasks(admin, newRound.id);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

async function assignBalancedTasks(admin: any, roundId: string) {
  // First, ensure all authenticated users have profiles
  await ensureUserProfiles(admin);

  // Get all users from auth system and profiles
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
  if (authError) throw new Error(authError.message);

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, username");
  if (profilesError) throw new Error(profilesError);

  // Get all user IDs from profiles
  const userIds = (profiles ?? []).map((p: any) => p.id as string);
  if (userIds.length === 0) {
    console.log("No users found in profiles table");
    return;
  }

  // Get tasks by category for this round
  const { data: allTasks, error: tasksError } = await admin
    .from("tasks")
    .select("id, title")
    .eq("round_id", roundId);
  if (tasksError) throw new Error(tasksError.message);

  if (!allTasks || allTasks.length === 0) {
    console.log("No tasks found for this round");
    return;
  }

  // Group tasks by category (we'll simulate categories since they're not in DB)
  const movementTasks = allTasks?.slice(0, 10) || [];
  const observationTasks = allTasks?.slice(10, 20) || [];
  const socialTasks = allTasks?.slice(20, 30) || [];
  const weirdTasks = allTasks?.slice(30, 40) || [];

  // Shuffle each category
  const shuffleArray = (arr: any[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const shuffledMovement = shuffleArray(movementTasks);
  const shuffledObservation = shuffleArray(observationTasks);
  const shuffledSocial = shuffleArray(socialTasks);
  const shuffledWeird = shuffleArray(weirdTasks);

  // Assign 5 tasks per user: 2 movement, 1 observation, 1 social, 1 weird
  const rowsToInsert: { user_id: string; task_id: string }[] = [];

  for (const userId of userIds) {
    // Get 2 random movement tasks
    const userMovementTasks = shuffledMovement.slice(0, 2);
    const userObservationTask = shuffledObservation.slice(0, 1)[0];
    const userSocialTask = shuffledSocial.slice(0, 1)[0];
    const userWeirdTask = shuffledWeird.slice(0, 1)[0];

    const userTasks = [
      ...userMovementTasks,
      userObservationTask,
      userSocialTask,
      userWeirdTask
    ].filter(Boolean);

    for (const task of userTasks) {
      rowsToInsert.push({
        user_id: userId,
        task_id: task.id
      });
    }
  }

  // Insert all assignments
  if (rowsToInsert.length > 0) {
    const { error: insertError } = await admin
      .from("assigned_tasks")
      .insert(rowsToInsert);
    if (insertError) throw new Error(insertError.message);
    
    console.log(`Assigned ${rowsToInsert.length} tasks to ${userIds.length} users`);
  }
}

async function ensureUserProfiles(admin: any) {
  // Get all auth users
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
  if (authError) {
    console.log("Could not list auth users:", authError);
    return;
  }

  if (!authUsers.users || authUsers.users.length === 0) {
    console.log("No auth users found");
    return;
  }

  // Get existing profiles
  const { data: existingProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id");
  if (profilesError) {
    console.log("Could not fetch existing profiles:", profilesError);
    return;
  }

  const existingUserIds = new Set((existingProfiles ?? []).map((p: any) => p.id));
  
  // Create missing profiles
  const profilesToCreate = authUsers.users
    .filter(user => !existingUserIds.has(user.id))
    .map(user => ({
      id: user.id,
      username: user.email?.split('@')[0] || user.user_metadata?.username || 'Player'
    }));

  if (profilesToCreate.length > 0) {
    const { error: insertError } = await admin
      .from("profiles")
      .insert(profilesToCreate);
    
    if (insertError) {
      console.log("Could not create profiles:", insertError);
    } else {
      console.log(`Created ${profilesToCreate.length} new user profiles`);
    }
  }
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

