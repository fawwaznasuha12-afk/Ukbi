export interface ScoredSession {
  createdAt: Date;
  status: string;
  percentage: number | null;
  durationSec: number;
  breakdown?: Record<string, { scored: number; correct: number; percentage: number | null }>;
}

export interface DashboardStats {
  completedCount: number;
  averagePercentage: number | null;
  totalMinutes: number;
  /** Nilai per kategori, rata-rata berbobot jumlah soal dinilai. */
  categoryAverages: Record<string, number>;
  /** Sesi selesai, terurut waktu (lama → baru), untuk grafik tren. */
  trend: { sessionAt: Date; percentage: number }[];
}

export function computeStats(sessions: readonly ScoredSession[]): DashboardStats {
  const completed = sessions
    .filter((s) => s.status === "COMPLETED")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const withPct = completed.filter((s): s is ScoredSession & { percentage: number } => s.percentage !== null);
  const averagePercentage =
    withPct.length === 0
      ? null
      : Math.round((withPct.reduce((sum, s) => sum + s.percentage, 0) / withPct.length) * 10) / 10;

  const catTotals: Record<string, { scored: number; correct: number }> = {};
  for (const s of completed) {
    for (const [code, v] of Object.entries(s.breakdown ?? {})) {
      const t = (catTotals[code] ??= { scored: 0, correct: 0 });
      t.scored += v.scored;
      t.correct += v.correct;
    }
  }
  const categoryAverages: Record<string, number> = {};
  for (const [code, t] of Object.entries(catTotals)) {
    if (t.scored > 0) categoryAverages[code] = Math.round((t.correct / t.scored) * 1000) / 10;
  }

  return {
    completedCount: completed.length,
    averagePercentage,
    totalMinutes: Math.round(sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60),
    categoryAverages,
    trend: withPct.map((s) => ({ sessionAt: s.createdAt, percentage: s.percentage })),
  };
}
