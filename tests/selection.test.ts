import { describe, expect, it } from "vitest";
import { selectQuestions } from "../src/domain/selection/select";
import { InsufficientQuestionsError } from "../src/domain/selection/types";
import { makeBank } from "./fixtures";

describe("selectQuestions", () => {
  it("tidak menghasilkan duplikat dalam satu sesi", () => {
    const ids = selectQuestions(makeBank(30), { count: 20, seed: "s1" });
    expect(new Set(ids).size).toBe(20);
  });

  it("deterministik untuk seed yang sama, berbeda untuk seed lain", () => {
    const a = selectQuestions(makeBank(30), { count: 10, seed: "same" });
    const b = selectQuestions(makeBank(30), { count: 10, seed: "same" });
    const c = selectQuestions(makeBank(30), { count: 10, seed: "other" });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("mengutamakan soal yang belum pernah muncul", () => {
    const bank = makeBank(10).map((q, i) =>
      i < 5
        ? { ...q, exposure: { timesSeen: 3, lastSeenAt: new Date(2026, 0, 1), lastCorrect: true } }
        : q,
    );
    const ids = selectQuestions(bank, { count: 5, seed: "x" });
    expect(ids.every((id) => Number(id.slice(1)) >= 5)).toBe(true);
  });

  it("jika semua sudah pernah muncul, pilih yang paling lama tidak muncul", () => {
    const bank = makeBank(6, ["reading"]).map((q, i) => ({
      ...q,
      exposure: { timesSeen: 1, lastSeenAt: new Date(2026, 0, 10 + i), lastCorrect: true },
    }));
    const ids = selectQuestions(bank, { count: 2, seed: "x" });
    expect(ids.sort()).toEqual(["q0", "q1"]);
  });

  it("mode weak memprioritaskan soal yang terakhir salah", () => {
    const bank = makeBank(6, ["reading"]).map((q, i) => ({
      ...q,
      exposure: { timesSeen: 1, lastSeenAt: new Date(2026, 0, 1), lastCorrect: i === 4 ? false : true },
    }));
    const ids = selectQuestions(bank, { count: 1, seed: "x", focus: "weak" });
    expect(ids).toEqual(["q4"]);
  });

  it("distribusi kategori seimbang", () => {
    const bank = makeBank(30);
    const ids = selectQuestions(bank, { count: 9, seed: "bal" });
    const cat = new Map(bank.map((q) => [q.id, q.categoryCode]));
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(cat.get(id)!, (counts.get(cat.get(id)!) ?? 0) + 1);
    expect([...counts.values()]).toEqual([3, 3, 3]);
  });

  it("melempar error jika soal unik tidak cukup", () => {
    expect(() => selectQuestions(makeBank(3), { count: 5, seed: "x" })).toThrow(InsufficientQuestionsError);
  });

  it("mengabaikan id duplikat di pool", () => {
    const bank = [...makeBank(3), ...makeBank(3)];
    expect(() => selectQuestions(bank, { count: 4, seed: "x" })).toThrow(InsufficientQuestionsError);
  });
});
