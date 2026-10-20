import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { categoryLabels } from "@/lib/labels";
import { TrendChart, CategoryChart } from "./charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const { stats } = await getContainer().practice.dashboard(user.id);
  const trend = stats.trend.map((t, i) => ({
    label: `Sesi ${i + 1}`,
    percentage: t.percentage,
  }));
  const cats = Object.entries(stats.categoryAverages).map(([code, pct]) => ({
    category: categoryLabels[code] ?? code,
    percentage: pct,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Hasil &amp; Analisis</h1>
      <p className="text-sm text-muted">Semua angka dihitung dari sesi Anda yang tersimpan. Ini Nilai Latihan, bukan skor resmi UKBI.</p>

      {stats.completedCount === 0 ? (
        <p className="rounded-lg border border-dashed border-rule bg-surface p-10 text-center text-sm text-muted">
          Belum ada sesi selesai. Analisis muncul setelah Anda mengirim sesi pertama.
        </p>
      ) : (
        <>
          <section className="panel p-5">
            <h2 className="mb-4 font-medium">Tren Nilai Latihan</h2>
            {trend.length >= 1 ? <TrendChart data={trend} /> : <p className="text-sm text-muted">Belum ada sesi yang dinilai otomatis.</p>}
          </section>
          <section className="panel p-5">
            <h2 className="mb-4 font-medium">Ketepatan per kategori</h2>
            {cats.length === 0 ? <p className="text-sm text-muted">Belum ada soal yang dinilai.</p> : <CategoryChart data={cats} />}
          </section>
        </>
      )}
    </div>
  );
}
