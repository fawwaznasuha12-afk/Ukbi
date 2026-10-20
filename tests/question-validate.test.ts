import { describe, expect, it } from "vitest";
import { validateDraft, normalizeText, type QuestionDraft } from "../src/domain/questions/validate";

const base: QuestionDraft = {
  categoryCode: "reading",
  type: "READING_MC",
  difficulty: "MEDIUM",
  level: "SMA_SMK",
  transcript: null,
  stem: "Apa gagasan utama bacaan tentang irigasi desa?",
  options: [{ text: "Irigasi memengaruhi panen." }, { text: "Desa kekurangan air." }],
  answerKey: "A",
  explanation: "Teks menyebut kenaikan panen setelah irigasi.",
  rubric: null,
  source: "sampel-orisinal",
};

describe("validateDraft", () => {
  it("draft valid lolos dan label pilihan dibuat otomatis A, B, ...", () => {
    const r = validateDraft(base, []);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.options.map((o) => o.label)).toEqual(["A", "B"]);
  });

  it("kunci jawaban harus salah satu label", () => {
    const r = validateDraft({ ...base, answerKey: "Z" }, []);
    expect(r.ok).toBe(false);
  });

  it("duplikat teks soal ditolak walau beda tanda baca dan kapitalisasi", () => {
    const existing = [{ id: "old", stem: "apa gagasan utama bacaan tentang irigasi desa", optionTexts: ["x", "y"], status: "ACTIVE" as const }];
    const r = validateDraft(base, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Duplikat/);
  });

  it("pilihan yang sama dengan urutan berbeda dianggap duplikat", () => {
    const existing = [{ id: "old", stem: "Soal lain yang sama sekali berbeda", optionTexts: ["Desa kekurangan air.", "Irigasi memengaruhi panen."], status: "ACTIVE" as const }];
    const r = validateDraft({ ...base, stem: "Soal lain yang sama sekali berbeda" }, existing);
    expect(r.ok).toBe(false);
  });

  it("soal yang diarsipkan tidak dihitung sebagai duplikat", () => {
    const existing = [{ id: "old", stem: base.stem, optionTexts: [], status: "ARCHIVED" as const }];
    expect(validateDraft(base, existing).ok).toBe(true);
  });

  it("saat edit, soal itu sendiri tidak dihitung duplikat", () => {
    const existing = [{ id: "self", stem: base.stem, optionTexts: ["Irigasi memengaruhi panen.", "Desa kekurangan air."], status: "ACTIVE" as const }];
    expect(validateDraft(base, existing, "self").ok).toBe(true);
  });

  it("esai wajib rubrik dan tanpa pilihan", () => {
    const essay = { ...base, type: "ESSAY", options: [], answerKey: null, rubric: null };
    expect(validateDraft(essay, []).ok).toBe(false);
    const ok = validateDraft({ ...essay, rubric: { minWords: 10, maxWords: 80, minSentences: 2, requiredKeywords: [] } }, []);
    expect(ok.ok).toBe(true);
  });

  it("kategori tidak dikenal ditolak", () => {
    expect(validateDraft({ ...base, categoryCode: "matematika" }, []).ok).toBe(false);
  });

  it("pilihan kosong ditolak", () => {
    expect(validateDraft({ ...base, options: [{ text: "A" }, { text: "   " }] }, []).ok).toBe(false);
  });

  it("normalizeText membuang tanda baca dan spasi ganda", () => {
    expect(normalizeText("  Halo,   DUNIA!! ")).toBe("halo dunia");
  });

  it("pilihan yang hanya beda tanda baca atau huruf besar BUKAN duplikat", () => {
    const r = validateDraft(
      { ...base, stem: "Ibu membeli apa saja di pasar pagi tadi?", options: [{ text: "Ibu membeli apel, jeruk, dan mangga." }, { text: "Ibu membeli apel jeruk dan mangga." }], answerKey: "A" },
      [],
    );
    expect(r.ok).toBe(true);
  });

  it("pilihan yang persis sama tetap ditolak", () => {
    const r = validateDraft({ ...base, options: [{ text: "Sama persis." }, { text: "Sama   persis." }] }, []);
    expect(r.ok).toBe(false);
  });
});
