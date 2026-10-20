"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { createSessionInput, answerInput } from "@/lib/validation/schemas";

const idSchema = z.string().min(1).max(100);

export async function createSessionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createSessionInput.safeParse({
    mode: formData.get("mode"),
    categoryCode: formData.get("categoryCode") || undefined,
    difficulty: formData.get("difficulty") || undefined,
    level: formData.get("level") || undefined,
    questionCount: Number(formData.get("questionCount")),
  });
  if (!parsed.success) {
    redirect(`/practice?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Input tidak valid.")}`);
  }
  let id: string;
  try {
    const s = await getContainer().practice.createSession(user.id, parsed.data);
    id = s.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat sesi.";
    redirect(`/practice?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  redirect(`/sessions/${id}`);
}

export async function startAction(sessionId: string) {
  const user = await requireUser();
  await getContainer().practice.start(user.id, idSchema.parse(sessionId));
  revalidatePath(`/sessions/${sessionId}`);
}

export async function pauseAction(sessionId: string) {
  const user = await requireUser();
  await getContainer().practice.pause(user.id, idSchema.parse(sessionId));
  revalidatePath(`/sessions/${sessionId}`);
}

export async function resumeAction(sessionId: string) {
  const user = await requireUser();
  await getContainer().practice.resume(user.id, idSchema.parse(sessionId));
  revalidatePath(`/sessions/${sessionId}`);
}

export async function saveAnswerAction(sessionId: string, input: { position: number; response: string | null; flagged?: boolean }) {
  const user = await requireUser();
  const parsed = answerInput.parse(input);
  await getContainer().practice.saveAnswer(user.id, idSchema.parse(sessionId), parsed);
  return { ok: true as const, savedAt: new Date().toISOString() };
}

export async function submitAction(sessionId: string) {
  const user = await requireUser();
  await getContainer().practice.submit(user.id, idSchema.parse(sessionId));
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  redirect(`/results/${sessionId}`);
}
