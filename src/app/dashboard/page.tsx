import Link from "next/link";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { modeLabel } from "@/services/practice";
import { statusLabel, categoryLabels } from "@/lib/labels";
import { formatScore, formatDateTime } from "@/lib/format";
import { levelLabel } from "@/domain/levels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const { stats, recent } = await getContainer().practice.dashboard(user.id);

  return (
    <div className="space-y-12">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="serif text-3xl">Ringkasan</h1>
          <p className="mt-2 text-sm text-muted">Skor dihitung dari sesi yang sudah dikirim.</p>
        </div>
        <Link href="/practice" className="btn-primary">Latihan baru</Link>
      </section>

      <dl className="grid grid-cols-1 divide-y divide-rule border-y border-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Figure label="Sesi selesai" value={String(stats.completedCount)} />
        <Figure label="Rata-rata skor akhir" value={formatScore(stats.averagePercentage)} />
        <Figure label="Waktu belajar" value={stats.totalMinutes === 0 ? "< 1 menit" : `${stats.totalMinutes} menit`} />
      </dl>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Sesi terakhir</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            Belum ada sesi. <Link href="/practice" className="link">Buat sesi pertama</Link>, lalu kirim untuk melihat skor.
          </p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted">
                    {modeLabel(s.mode)} · {levelLabel(s.level)} · {s.questionCount} soal · {statusLabel(s.status)} · {formatDateTime(s.createdAt)}
                  </p>
                </div>
                {s.status === "COMPLETED" ? (
                  <Link href={`/results/${s.id}`} className="link text-sm">
                    Skor {formatScore((s.result as { finalScore: number | null } | null)?.finalScore ?? null)}
                  </Link>
                ) : s.status === "CANCELLED" ? null : (
                  <Link href={`/sessions/${s.id}`} className="link text-sm">Lanjutkan</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {Object.keys(stats.categoryAverages).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Ketepatan per kategori</h2>
          <ul className="space-y-3">
            {Object.entries(stats.categoryAverages).map(([code, pct]) => (
              <li key={code} className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-4 text-sm">
                <span>{categoryLabels[code] ?? code}</span>
                <span className="h-px bg-rule relative">
                  <span className="absolute -top-px left-0 h-[3px] bg-accent" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right tabular-nums">{formatScore(pct)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-5 sm:px-6 first:sm:pl-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="serif mt-1 text-3xl tabular-nums">{value}</dd>
    </div>
  );
}
