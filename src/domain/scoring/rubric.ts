export interface Rubric {
  minWords: number;
  maxWords: number;
  minSentences: number;
  /** Kata kunci yang harus muncul. Hanya cek keberadaan, bukan mutu gagasan. */
  requiredKeywords: string[];
}

export interface CriterionResult {
  id: string;
  label: string;
  passed: boolean;
  reason: string;
}

export interface EssayEvaluation {
  /** 0–100, persentase kriteria yang terpenuhi. */
  score: number;
  criteria: CriterionResult[];
  wordCount: number;
  sentenceCount: number;
}

/**
 * Penilaian rubrik SEDERHANA dan transparan: jumlah kata, jumlah kalimat, dan kata kunci.
 * Tidak menilai koherensi, ketepatan bahasa, atau mutu argumen. Itu butuh penilai manusia.
 */
export function evaluateEssay(text: string | null, rubric: Rubric): EssayEvaluation {
  const body = (text ?? "").trim();
  const words = body ? body.split(/\s+/).filter(Boolean).length : 0;
  const sentences = body ? body.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length : 0;

  const criteria: CriterionResult[] = [
    {
      id: "min-words",
      label: `Minimal ${rubric.minWords} kata`,
      passed: words >= rubric.minWords,
      reason: `${words} kata`,
    },
    {
      id: "max-words",
      label: `Maksimal ${rubric.maxWords} kata`,
      passed: words > 0 && words <= rubric.maxWords,
      reason: `${words} kata`,
    },
    {
      id: "min-sentences",
      label: `Minimal ${rubric.minSentences} kalimat`,
      passed: sentences >= rubric.minSentences,
      reason: `${sentences} kalimat`,
    },
    ...rubric.requiredKeywords.map<CriterionResult>((kw) => {
      const hit = body.toLowerCase().includes(kw.toLowerCase());
      return { id: `kw-${kw}`, label: `Memuat kata kunci "${kw}"`, passed: hit, reason: hit ? "ada" : "tidak ada" };
    }),
  ];

  if (!body) {
    return { score: 0, criteria, wordCount: 0, sentenceCount: 0 };
  }
  const passed = criteria.filter((c) => c.passed).length;
  return {
    score: Math.round((passed / criteria.length) * 1000) / 10,
    criteria,
    wordCount: words,
    sentenceCount: sentences,
  };
}
