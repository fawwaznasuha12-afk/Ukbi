import { requireAdmin } from "@/lib/auth-guard";
import { createQuestionAction } from "../../actions";
import { QuestionFields } from "../form-fields";

export const dynamic = "force-dynamic";

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Tambah Soal</h1>
      {error && <p role="alert" className="rounded-lg notice-error">{error}</p>}
      <form action={createQuestionAction} className="space-y-4 panel p-5">
        <QuestionFields />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#174a44]">Simpan soal</button>
      </form>
    </div>
  );
}
