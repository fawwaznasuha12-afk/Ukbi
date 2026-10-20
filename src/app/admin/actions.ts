"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { getContainer } from "@/lib/container";
import { QuestionValidationError } from "@/services/question-admin";
import type { QuestionDraft } from "@/domain/questions/validate";
import { parseQuestionForm } from "@/lib/question-form";

function errorRedirect(path: string, errors: string[]): never {
  redirect(`${path}?error=${encodeURIComponent(errors.join(" "))}`);
}

export async function createQuestionAction(formData: FormData) {
  await requireAdmin();
  const draft: QuestionDraft = parseQuestionForm(formData);
  try {
    await getContainer().questionAdmin.create(draft);
  } catch (e) {
    if (e instanceof QuestionValidationError) errorRedirect("/admin/questions/new", e.errors);
    throw e;
  }
  revalidatePath("/admin/questions");
  revalidatePath("/question-bank");
  redirect("/admin/questions");
}

export async function updateQuestionAction(id: string, formData: FormData) {
  await requireAdmin();
  const draft: QuestionDraft = parseQuestionForm(formData);
  try {
    await getContainer().questionAdmin.update(id, draft);
  } catch (e) {
    if (e instanceof QuestionValidationError) errorRedirect(`/admin/questions/${id}`, e.errors);
    throw e;
  }
  revalidatePath("/admin/questions");
  redirect("/admin/questions");
}

export async function setArchivedAction(id: string, archived: boolean) {
  await requireAdmin();
  await getContainer().questionAdmin.setArchived(id, archived);
  revalidatePath("/admin/questions");
  revalidatePath("/question-bank");
}
