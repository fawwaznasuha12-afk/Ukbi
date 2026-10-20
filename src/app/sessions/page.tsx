import Link from "next/link";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { modeLabel } from "@/services/practice";
import { statusLabel, categoryLabels } from "@/lib/labels";
import { levelLabel } from "@/domain/levels";

export const dynamic = "force-dynamic";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"];

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; sort?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = await getContainer().practice.listPage(user.id, {
    q: sp.q,
    status: sp.status || undefined,
    category: sp.category || undefined,
    sort: sp.sort === "oldest" ? "oldest" : "newest",
    page: Number(sp.page ?? 1) || 1,
    pageSize: 10,
  });

  const qs = (over: Record<string, string | number | undefined>) => {
    const merged = { ...sp, ...over };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") params.set(k, String(v));
    return `/sessions?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Semua Sesi</h1>

      <form className="grid grid-cols-1 gap-3 panel p-4 sm:grid-cols-5" role="search">
        <label className="sm:col-span-2 text-sm">
          <span className="mb-1 block font-medium">Cari judul</span>
          <input name="q" defaultValue={sp.q ?? ""} className="w-full rounded-lg border border-rule p-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="w-full rounded-lg border border-rule bg-white p-2">
            <option value="">Semua</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Kategori</span>
          <select name="category" defaultValue={sp.category ?? ""} className="w-full rounded-lg border border-rule bg-white p-2">
            <option value="">Semua</option>
            {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Urutkan</span>
          <select name="sort" defaultValue={sp.sort ?? "newest"} className="w-full rounded-lg border border-rule bg-white p-2">
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </select>
        </label>
        <div className="sm:col-span-5 flex justify-end">
          <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm text-white">Terapkan</button>
        </div>
      </form>

      {page.total === 0 ? (
        <p className="rounded-lg border border-dashed border-rule bg-surface p-10 text-center text-sm text-muted">
          Tidak ada sesi yang cocok. <Link href="/practice" className="text-accent underline">Buat sesi baru</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-rule panel">
          {page.items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">#{s.sessionNumber} · {s.title}</p>
                <p className="text-xs text-muted">
                  {modeLabel(s.mode)} · {levelLabel(s.level)} · {statusLabel(s.status)} · {s.questionCount} soal · {new Date(s.createdAt).toLocaleString("id-ID")}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                {s.status === "COMPLETED" ? (
                  <>
                    <Link href={`/results/${s.id}`} className="text-accent underline underline-offset-4">Lihat Hasil</Link>
                    <Link href={`/results/${s.id}#pembahasan`} className="text-accent underline underline-offset-4">Lihat Pembahasan</Link>
                  </>
                ) : s.status === "CANCELLED" ? null : (
                  <Link href={`/sessions/${s.id}`} className="text-accent underline underline-offset-4">Lanjutkan</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {page.pageCount > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page.page > 1 ? <Link href={qs({ page: page.page - 1 })} className="underline">← Sebelumnya</Link> : <span />}
          <span>Halaman {page.page} dari {page.pageCount}</span>
          {page.page < page.pageCount ? <Link href={qs({ page: page.page + 1 })} className="underline">Berikutnya →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
