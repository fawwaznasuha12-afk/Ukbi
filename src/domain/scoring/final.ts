export interface FinalScoreInput {
  /** Pilihan ganda yang punya kunci. */
  objective: { correct: boolean }[];
  /** Soal esai yang dinilai rubrik, skor 0–100. */
  essays: { score: number }[];
}

export interface FinalScore {
  /** Rata-rata semua soal yang dinilai, 0–100. null jika tidak ada soal yang dinilai. */
  finalScore: number | null;
  gradedCount: number;
  objectiveCorrect: number;
  objectiveTotal: number;
  essayAverage: number | null;
  essayCount: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Skor akhir latihan: setiap soal yang dinilai punya bobot sama.
 * Pilihan ganda benar = 100, salah atau kosong = 0. Esai = skor rubrik.
 * Ini Nilai Latihan, bukan skor resmi UKBI.
 */
export function computeFinalScore(input: FinalScoreInput): FinalScore {
  const points = [
    ...input.objective.map((o) => (o.correct ? 100 : 0)),
    ...input.essays.map((e) => e.score),
  ];
  const essayAverage =
    input.essays.length === 0
      ? null
      : round1(input.essays.reduce((s, e) => s + e.score, 0) / input.essays.length);
  return {
    finalScore: points.length === 0 ? null : round1(points.reduce((s, p) => s + p, 0) / points.length),
    gradedCount: points.length,
    objectiveCorrect: input.objective.filter((o) => o.correct).length,
    objectiveTotal: input.objective.length,
    essayAverage,
    essayCount: input.essays.length,
  };
}
