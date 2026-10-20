import { describe, expect, it } from "vitest";
import { scoreSession } from "../src/domain/scoring/score";

const base = { questionId: "q", categoryCode: "reading" };

describe("scoreSession", () => {
  it("percentage null jika tidak ada soal yang dinilai (tanpa pembagian nol)", () => {
    const r = scoreSession([{ ...base, answerKey: null, response: "A" }]);
    expect(r.scoredCount).toBe(0);
    expect(r.percentage).toBeNull();
  });

  it("hitung benar, salah, belum dijawab, dan persentase", () => {
    const r = scoreSession([
      { ...base, answerKey: "A", response: "A" },
      { ...base, answerKey: "B", response: "C" },
      { ...base, answerKey: "C", response: null },
      { ...base, answerKey: "D", response: "d" },
    ]);
    expect(r).toMatchObject({ scoredCount: 4, correct: 2, wrong: 1, unanswered: 1, percentage: 50 });
    expect(r.label).toBe("Nilai Latihan");
  });

  it("soal esai (answerKey null) tidak masuk penilaian", () => {
    const r = scoreSession([
      { ...base, answerKey: "A", response: "A" },
      { questionId: "w", categoryCode: "writing", answerKey: null, response: "teks panjang" },
    ]);
    expect(r.scoredCount).toBe(1);
    expect(r.breakdown.writing).toBeUndefined();
    expect(r.breakdown.reading).toEqual({ scored: 1, correct: 1, percentage: 100 });
  });
});
