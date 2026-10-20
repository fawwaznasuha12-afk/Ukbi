export interface ScorableItem {
  questionId: string;
  categoryCode: string;
  /** null = soal tidak dinilai otomatis (esai/rubrik/audio). */
  answerKey: string | null;
  /** null = belum dijawab. */
  response: string | null;
}

export interface CategoryBreakdown {
  scored: number;
  correct: number;
  percentage: number | null;
}

export interface ScoreResult {
  scoredCount: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** null jika tidak ada soal yang dinilai (hindari pembagian nol). */
  percentage: number | null;
  label: "Nilai Latihan";
  breakdown: Record<string, CategoryBreakdown>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Penilaian murni (tanpa I/O). Hanya dipanggil di server.
 * Soal tanpa answerKey tidak masuk scoredCount.
 */
export function scoreSession(items: readonly ScorableItem[]): ScoreResult {
  let scoredCount = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  const breakdown: Record<string, { scored: number; correct: number }> = {};

  for (const item of items) {
    if (item.answerKey === null) continue;
    scoredCount++;
    const cat = (breakdown[item.categoryCode] ??= { scored: 0, correct: 0 });
    cat.scored++;

    if (item.response === null || item.response === "") {
      unanswered++;
    } else if (item.response.trim().toUpperCase() === item.answerKey.trim().toUpperCase()) {
      correct++;
      cat.correct++;
    } else {
      wrong++;
    }
  }

  const finalBreakdown: Record<string, CategoryBreakdown> = {};
  for (const [code, v] of Object.entries(breakdown)) {
    finalBreakdown[code] = {
      scored: v.scored,
      correct: v.correct,
      percentage: v.scored === 0 ? null : round1((v.correct / v.scored) * 100),
    };
  }

  return {
    scoredCount,
    correct,
    wrong,
    unanswered,
    percentage: scoredCount === 0 ? null : round1((correct / scoredCount) * 100),
    label: "Nilai Latihan",
    breakdown: finalBreakdown,
  };
}
