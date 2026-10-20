import { describe, expect, it } from "vitest";
import { buildBank } from "../src/domain/questions/bank";
import { loadBankFiles, BANK_DIR } from "../src/lib/bank-loader";
import { sampleQuestions } from "../prisma/seed/sample-questions";

const sampleView = sampleQuestions.map((q) => ({
  id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status,
}));

describe("bank soal di content/bank", () => {
  const files = loadBankFiles(BANK_DIR);
  const result = buildBank(files, sampleView, new Date(0));

  it("semua soal lolos validasi yang sama dengan admin", () => {
    expect(result.errors).toEqual([]);
  });

  it("jumlah soal sesuai jumlah item di berkas, tidak ada yang hilang", () => {
    const total = files.reduce((n, f) => n + f.items.length, 0);
    expect(result.records).toHaveLength(total);
  });

  it("id unik dan tidak bertabrakan dengan sampel", () => {
    const ids = result.records.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sampleIds = new Set(sampleQuestions.map((q) => q.id));
    expect(ids.some((id) => sampleIds.has(id))).toBe(false);
  });

  it("tidak ada teks soal yang sama (setelah normalisasi) di seluruh bank", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    const identity = (r: { stem: string; transcript: string | null }) => (r.transcript ? `${r.transcript} ${r.stem}` : r.stem);
    const stems = [...sampleQuestions.map((q) => identity(q)), ...result.records.map((r) => identity(r))].map(norm);
    expect(new Set(stems).size).toBe(stems.length);
  });

  it("setiap soal pilihan ganda punya kunci yang cocok dengan pilihannya", () => {
    for (const r of result.records.filter((x) => x.type !== "ESSAY")) {
      expect(r.options.some((o) => o.label === r.answerKey)).toBe(true);
      expect(r.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });

  it("setiap soal punya pembahasan dan kategori yang dikenal", () => {
    const cats = new Set(["listening", "language_rules", "reading", "writing", "speaking"]);
    for (const r of result.records) {
      expect(r.explanation.trim().length).toBeGreaterThan(0);
      expect(cats.has(r.categoryCode)).toBe(true);
    }
  });

  it("cakupan per kategori cukup untuk mode latihan", () => {
    const count = (c: string) => result.records.filter((r) => r.categoryCode === c).length;
    expect(count("language_rules")).toBeGreaterThanOrEqual(20);
    expect(count("reading")).toBeGreaterThanOrEqual(20);
    expect(count("listening")).toBeGreaterThanOrEqual(12);
    expect(count("writing")).toBeGreaterThanOrEqual(8);
  });

  it("soal esai punya rubrik, soal pilihan ganda tidak", () => {
    for (const r of result.records) {
      if (r.type === "ESSAY") expect(r.rubric).not.toBeNull();
      else expect(r.rubric).toBeNull();
    }
  });

  it("duplikat yang sengaja dimasukkan ditolak buildBank", () => {
    const dup = buildBank(
      [{ name: "x.json", items: [{ c: "reading", t: "READING_MC", d: "EASY", l: "SD", s: sampleQuestions[0]!.stem, o: ["a", "b"], k: "A", e: "e" }] }],
      sampleView,
      new Date(0),
    );
    expect(dup.records).toHaveLength(0);
    expect(dup.errors[0]!.message).toMatch(/Duplikat/);
  });
});
