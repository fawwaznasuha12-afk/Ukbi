import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { getContainer } from "@/lib/container";
import { categoryLabels } from "@/lib/labels";
import { setArchivedAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const all = await getContainer().questionAdmin.list();
  const q = sp.q?.trim().toLowerCase() ?? "";
  const rows = all
    .filter((x) => (sp.status ? x.status === sp.status : true))
    .filter((x) => (q ? x.stem.toLowerCase().includes(q) || x.id.includes(q) : true));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin Bank Soal</h1>
          <p className="text-sm text-muted">{all.length} soal total · {all.filter((x) => x.status === "ACTIVE").length} aktif. Edit membuat versi baru; sesi lama tetap memakai versi lamanya.</p>
        </div>
        <Link href="/admin/questions/new" className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-[#174a44]">Tambah soal</Link>
      </div>

      <form className="flex flex-wrap gap-3 text-sm" role="search">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari teks soal atau ID" className="min-w-60 flex-1 rounded-lg border border-rule p-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-rule bg-white p-2">
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="ARCHIVED">Diarsipkan</option>
        </select>
        <button className="rounded-lg bg-ink px-4 py-2 text-white">Cari</button>
      </form>

      <ul className="divide-y divide-rule panel">
        {rows.map((x) => (
          <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{x.stem}</p>
              <p className="text-xs text-muted">
                {x.id} · v{x.version} · {categoryLabels[x.categoryCode] ?? x.categoryCode} · {x.difficulty} · {x.type}
                {x.status === "ARCHIVED" && <span className="ml-2 rounded bg-rule px-1.5 py-0.5">Diarsipkan</span>}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href={`/admin/questions/${x.id}`} className="text-accent underline">Edit</Link>
              <form action={setArchivedAction.bind(null, x.id, x.status !== "ARCHIVED")}>
                <button className="text-ink underline">{x.status === "ARCHIVED" ? "Aktifkan" : "Arsipkan"}</button>
              </form>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="p-6 text-center text-muted">Tidak ada soal yang cocok.</li>}
      </ul>
    </div>
  );
}
