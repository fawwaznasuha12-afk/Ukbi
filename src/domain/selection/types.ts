export type Difficulty = "EASY" | "MEDIUM" | "HARD";

/** Ringkasan soal untuk seleksi. Tidak memuat kunci jawaban. */
export interface CandidateQuestion {
  id: string;
  categoryCode: string;
  difficulty: Difficulty;
  /** Riwayat user terhadap soal ini; undefined = belum pernah muncul. */
  exposure?: {
    timesSeen: number;
    lastSeenAt: Date | null;
    lastCorrect: boolean | null;
  };
}

export interface SelectionOptions {
  count: number;
  seed: string;
  /** "weak" = prioritaskan soal yang terakhir dijawab salah. */
  focus?: "variety" | "weak";
}

export class InsufficientQuestionsError extends Error {
  constructor(
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Soal unik tidak cukup: diminta ${requested}, tersedia ${available}.`);
    this.name = "InsufficientQuestionsError";
  }
}
