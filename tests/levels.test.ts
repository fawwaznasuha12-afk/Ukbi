import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateDraft } from "../src/domain/questions/validate";
import { buildBank } from "../src/domain/questions/bank";
import { loadBankFiles, BANK_DIR } from "../src/lib/bank-loader";
import { openAppDb } from "../src/db/sqlite";
import { createPracticeService } from "../src/services/practice";
import { MemoryExposureRepository, MemoryQuestionRepository, MemorySessionRepository } from "../src/repositories/memory";
import { InsufficientQuestionsError } from "../src/domain/selection/types";
import { sampleQuestions } from "../prisma/seed/sample-questions";
import { LEVELS, levelLabel } from "../src/domain/levels";
import type { QuestionRecord } from "../src/repositories/types";

const draft = {
  categoryCode: "reading", type: "READING_MC", difficulty: "EASY", stem: "Apa gagasan utama bacaan ini tentang hujan?", transcript: null,
  options: [{ text: "Hujan membawa air." }, { text: "Hujan tidak penting." }], answerKey: "A",
  explanation: "Bacaan menyebut hujan membawa air.", rubric: null, source: "t",
};

describe("jenjang pada validasi", () => {
  it("jenjang wajib dan harus salah satu kode yang dikenal", () => {
    expect(validateDraft({ ...draft, level: "SMA_SMK" }, []).ok).toBe(true);
    expect(validateDraft({ ...draft, level: "TK" }, []).ok).toBe(false);
    expect(validateDraft({ ...draft, level: "" }, []).ok).toBe(false);
  });

  it("label jenjang untuk tampilan", () => {
    expect(levelLabel("SMA_SMK")).toBe("SMA/SMK");
    expect(levelLabel("SEMUA")).toBe("Semua jenjang");
  });
});

describe("pilih jenjang saat membuat sesi", () => {
  function setup(questions: QuestionRecord[]) {
    let n = 0;
    return createPracticeService({
      questions: new MemoryQuestionRepository(structuredClone(questions)),
      exposures: new MemoryExposureRepository(),
      sessions: new MemorySessionRepository(),
      newId: () => `l-${++n}`,
    });
  }

  it("jenjang SD hanya mengambil soal SD", async () => {
    const svc = setup(sampleQuestions);
    const s = await svc.createSession("u1", { mode: "CATEGORY", categoryCode: "reading", level: "SD", questionCount: 1 });
    const sdIds = new Set(sampleQuestions.filter((q) => q.level === "SD").map((q) => q.id));
    expect(sdIds.has(s.items[0]!.questionId)).toBe(true);
    expect(s.level).toBe("SD");
  });

  it("'Semua jenjang' tidak memfilter", async () => {
    const svc = setup(sampleQuestions);
    const s = await svc.createSession("u1", { mode: "QUICK", questionCount: 3 });
    expect(s.level).toBe("SEMUA");
    expect(s.items).toHaveLength(3);
  });

  it("jenjang tanpa soal yang cukup: pesan kekurangan soal, bukan sesi kosong", async () => {
    const svc = setup(sampleQuestions.filter((q) => q.level !== "LANJUTAN"));
    await expect(svc.createSession("u1", { mode: "QUICK", level: "LANJUTAN", questionCount: 3 })).rejects.toBeInstanceOf(InsufficientQuestionsError);
  });
});

describe("migrasi database lama", () => {
  it("database tanpa kolom level diberi kolom dan data lama tetap ada", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "ukbi-mig-")), "app.db");
    const db = openAppDb(file);
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    db.close();

    // Simulasi database lama: buang kolom level dari kedua tabel.
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    const raw = new DatabaseSync(file);
    raw.exec("ALTER TABLE questions DROP COLUMN level; ALTER TABLE sessions DROP COLUMN level;");
    raw.close();

    const migrated = openAppDb(file);
    return migrated.questions.listAll().then((all) => {
      expect(all.length).toBe(sampleQuestions.length);
      expect(all.every((q) => (LEVELS as readonly string[]).includes(q.level))).toBe(true);
      migrated.close();
    });
  });
});

describe("cakupan bank per jenjang", () => {
  const files = loadBankFiles(BANK_DIR);
  const sampleView = sampleQuestions.map((q) => ({ id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status }));
  const bank = buildBank(files, sampleView, new Date(0));

  it("semua item bank punya jenjang yang valid dan tidak ada error", () => {
    expect(bank.errors).toEqual([]);
    for (const r of bank.records) expect((LEVELS as readonly string[]).includes(r.level)).toBe(true);
  });

  it("setiap jenjang punya minimal 7 soal dari bank", () => {
    for (const lv of LEVELS) {
      const n = [...bank.records, ...sampleQuestions].filter((q) => q.level === lv).length;
      expect(n).toBeGreaterThanOrEqual(7);
    }
  });
});
