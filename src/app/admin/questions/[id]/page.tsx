import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { getContainer } from "@/lib/container";
import { updateQuestionAction } from "../../actions";
import { QuestionFields } from "../form-fields";

export const dynamic = "force-dynamic";

export default async function EditQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const q = (await getContainer().questionAdmin.list()).find((x) => x.id === id);
  if (!q) notFound();
  const action = updateQuestionAction.bind(null, id);
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit Soal {q.id} <span className="text-sm font-normal text-muted">(v{q.version} → v{q.version + 1})</span></h1>
      {error && <p role="alert" className="rounded-lg notice-error">{error}</p>}
      <form action={action} className="space-y-4 panel p-5">
        <QuestionFields initial={q} />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#174a44]">Simpan perubahan</button>
      </form>
    </div>
  );
}
