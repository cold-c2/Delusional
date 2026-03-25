import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function corsHeaders(origin: string | null) {
  // For Vercel + same-origin usage, this is typically enough.
  // If you call this API from other origins, set ALLOWED_ORIGIN accordingly.
  const allowedOrigin = process.env.ALLOWED_ORIGIN ?? origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

function isAllowedMime(type: string) {
  return type.startsWith("image/") || type.startsWith("video/");
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { message: "Unauthorized" } },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: { message: "Expected multipart/form-data" } },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const assignedTaskId = String(form.get("assignedTaskId") ?? "").trim();
    const file = form.get("file");

    if (!assignedTaskId) {
      return NextResponse.json(
        { error: { message: "assignedTaskId is required" } },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { message: "file is required" } },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    if (!isAllowedMime(file.type)) {
      return NextResponse.json(
        { error: { message: "Only image/* or video/* uploads are allowed" } },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Verify the assigned task belongs to this user.
    const { data: assignedTask, error: assignedError } = await supabase
      .from("assigned_tasks")
      .select("id, user_id, completed")
      .eq("id", assignedTaskId)
      .maybeSingle();

    if (assignedError) {
      return NextResponse.json(
        { error: { message: assignedError.message } },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
    if (!assignedTask || assignedTask.user_id !== user.id) {
      return NextResponse.json(
        { error: { message: "Not found" } },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const objectName = crypto.randomUUID();
    const storagePath = `${user.id}/${assignedTaskId}/${objectName}.${ext}`;

    const admin = createSupabaseAdminClient();

    const { error: uploadError } = await admin.storage
      .from("task-proofs")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: { message: uploadError.message } },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    const { data: publicData } = admin.storage.from("task-proofs").getPublicUrl(storagePath);
    const fileUrl = publicData.publicUrl;

    const { data: proof, error: proofError } = await admin
      .from("proofs")
      .insert({
        assigned_task_id: assignedTaskId,
        file_url: fileUrl,
      })
      .select("id, file_url, submitted_at, assigned_task_id")
      .single();

    if (proofError) {
      return NextResponse.json(
        { error: { message: proofError.message } },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    const { error: completeError } = await admin
      .from("assigned_tasks")
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assignedTaskId);

    if (completeError) {
      return NextResponse.json(
        { error: { message: completeError.message } },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json(
      { data: { proof, storagePath, fileUrl } },
      { status: 201, headers: corsHeaders(origin) }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

