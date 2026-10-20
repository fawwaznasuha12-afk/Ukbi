import { describe, expect, it } from "vitest";
import { computeFinalScore } from "../src/domain/scoring/final";

describe("computeFinalScore", () => {
  it("tanpa soal yang dinilai: null, tidak ada pembagian nol", () => {
    const r = computeFinalScore({ objective: [], essays: [] });
    expect(r.finalScore).toBeNull();
    expect(r.gradedCount).toBe(0);
  });

  it("hanya pilihan ganda: rata-rata 0 atau 100", () => {
    const r = computeFinalScore({ objective: [{ correct: true }, { correct: true }, { correct: false }, { correct: false }], essays: [] });
    expect(r.finalScore).toBe(50);
    expect(r.objectiveCorrect).toBe(2);
    expect(r.objectiveTotal).toBe(4);
  });

  it("campuran: setiap soal bobot sama, esai pakai skor rubrik", () => {
    // 2 PG (100, 0) + 1 esai (60) → (100 + 0 + 60) / 3 = 53.3
    const r = computeFinalScore({ objective: [{ correct: true }, { correct: false }], essays: [{ score: 60 }] });
    expect(r.finalScore).toBe(53.3);
    expect(r.gradedCount).toBe(3);
    expect(r.essayAverage).toBe(60);
  });

  it("hanya esai: rata-rata skor rubrik", () => {
    const r = computeFinalScore({ objective: [], essays: [{ score: 40 }, { score: 80 }] });
    expect(r.finalScore).toBe(60);
    expect(r.essayCount).toBe(2);
  });

  it("satu angka desimal, dibulatkan dengan benar", () => {
    const r = computeFinalScore({ objective: [{ correct: true }, { correct: true }, { correct: false }], essays: [] });
    expect(r.finalScore).toBe(66.7);
  });
});
