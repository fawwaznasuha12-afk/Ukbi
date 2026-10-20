import { describe, expect, it } from "vitest";
import { createPracticeService, NotFoundError, SessionLockedError, toClientSession } from "../src/services/practice";
import { MemoryExposureRepository, MemoryQuestionRepository, MemorySessionRepository } from "../src/repositories/memory";
import { sampleQuestions } from "../prisma/seed/sample-questions";
import { makeBank } from "./fixtures";
import type { QuestionRecord } from "../src/repositories/types";

function setup(questions: QuestionRecord[] = sampleQuestions) {
  let clock = new Date("2026-10-01T08:00:00Z").getTime();
  let counter = 0;
  const qRepo = new MemoryQuestionRepository(questions);
  const exposures = new MemoryExposureRepository();
  const sessions = new MemorySessionRepository();
  const svc = createPracticeService({
    questions: qRepo,
    exposures,
    sessions,
    now: () => new Date((clock += 60_000)),
    newId: () => `id-${++counter}`,
  });
  return { svc, qRepo, exposures, sessions };
}

const custom = (n: number) => ({ mode: "WEAK_QUESTIONS" as const, questionCount: n });

describe("practice service: sesi persisten", () => {
  it("dua sesi baru memiliki ID dan nomor berbeda", async () => {
    const { svc } = setup();
    const a = await svc.createSession("u1", custom(3));
    const b = await svc.createSession("u1", custom(3));
    expect(a.id).not.toBe(b.id);
    expect([a.sessionNumber, b.sessionNumber]).toEqual([1, 2]);
  });

  it("snapshot soal tidak berubah ketika bank soal diedit", async () => {
    const { svc, qRepo } = setup();
    const s = await svc.createSession("u1", custom(2));
    const before = s.items.map((i) => i.stem);
    qRepo.update(s.items[0]!.questionId, { stem: "TEKS BARU" });
    const reopened = await svc.getSession("u1", s.id);
    expect(reopened.items.map((i) => i.stem)).toEqual(before);
  });

  it("jawaban tersimpan dan tetap ada saat sesi dibuka ulang", async () => {
    const { svc } = setup();
    const s = await svc.createSession("u1", custom(3));
    await svc.start("u1", s.id);
    await svc.saveAnswer("u1", s.id, { position: 1, response: "B", flagged: true });
    const reopened = await svc.getSession("u1", s.id);
    expect(reopened.items[1]!.response).toBe("B");
    expect(reopened.items[1]!.flagged).toBe(true);
    expect(reopened.lastIndex).toBe(1);
  });

  it("sesi selesai tidak berubah ketika sesi baru dibuat", async () => {
    const { svc } = setup();
    const a = await svc.createSession("u1", custom(3));
    await svc.start("u1", a.id);
    await svc.saveAnswer("u1", a.id, { position: 0, response: "B" });
    const done = await svc.submit("u1", a.id);
    await svc.createSession("u1", custom(3));
    const again = await svc.getSession("u1", a.id);
    expect(again).toEqual(done);
    expect(again.result).not.toBeNull();
  });

  it("sesi COMPLETED menolak perubahan jawaban", async () => {
    const { svc } = setup();
    const s = await svc.createSession("u1", custom(2));
    await svc.start("u1", s.id);
    await svc.submit("u1", s.id);
    await expect(svc.saveAnswer("u1", s.id, { position: 0, response: "A" })).rejects.toThrow(SessionLockedError);
  });

  it("pengguna lain tidak bisa mengakses sesi", async () => {
    const { svc } = setup();
    const s = await svc.createSession("u1", custom(2));
    await expect(svc.getSession("u2", s.id)).rejects.toThrow(NotFoundError);
    await expect(svc.start("u2", s.id)).rejects.toThrow(NotFoundError);
  });

  it("kunci jawaban & isCorrect tidak pernah ada di tampilan client selama sesi berjalan", async () => {
    const { svc } = setup();
    const s = await svc.createSession("u1", custom(3));
    await svc.start("u1", s.id);
    const json = JSON.stringify(await svc.getSession("u1", s.id));
    expect(json).not.toContain("answerKey");
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("correctLabel\":\"");
    expect(json).not.toContain("explanation\":\"");
  });

  it("pembahasan dan kunci baru dikirim setelah sesi selesai", async () => {
    const { svc } = setup();
    const s = await svc.createSession("u1", custom(2));
    await svc.start("u1", s.id);
    const done = await svc.submit("u1", s.id);
    expect(done.items.every((i) => i.explanation !== null)).toBe(true);
  });

  it("hasil penilaian dihitung di server dan benar", async () => {
    const { svc } = setup(makeBankAsRecords());
    const s = await svc.createSession("u1", custom(4));
    await svc.start("u1", s.id);
    await svc.saveAnswer("u1", s.id, { position: 0, response: "A" });
    const done = await svc.submit("u1", s.id);
    expect(done.result).toMatchObject({ scoredCount: 4, unanswered: 3, label: "Nilai Latihan" });
  });

  it("riwayat soal dicatat: soal yang muncul bertambah timesSeen", async () => {
    const { svc, exposures } = setup(makeBankAsRecords());
    const s = await svc.createSession("u1", custom(3));
    const map = await exposures.getForUser("u1");
    for (const item of s.items) expect(map.get(item.questionId)?.timesSeen).toBe(1);
  });

  it("sesi baru mengutamakan soal yang belum pernah muncul", async () => {
    const { svc } = setup(makeBankAsRecords());
    const first = await svc.createSession("u1", custom(4));
    const second = await svc.createSession("u1", custom(4));
    const firstIds = new Set(first.items.map((i) => i.questionId));
    const overlap = second.items.filter((i) => firstIds.has(i.questionId)).length;
    expect(overlap).toBe(0);
  });

  it("tidak ada duplikat soal dalam satu sesi", async () => {
    const { svc } = setup(makeBankAsRecords());
    const s = await svc.createSession("u1", custom(6));
    expect(new Set(s.items.map((i) => i.questionId)).size).toBe(6);
  });

  it("melempar error jika soal unik tidak cukup", async () => {
    const { svc } = setup(makeBankAsRecords());
    await expect(svc.createSession("u1", custom(20))).rejects.toThrow(/Soal unik tidak cukup/);
  });

  it("mode kategori memfilter soal", async () => {
    const { svc } = setup(makeBankAsRecords());
    const s = await svc.createSession("u1", { mode: "CATEGORY", categoryCode: "reading", questionCount: 2 });
    expect(s.items.every((i) => i.categoryCode === "reading")).toBe(true);
  });

  it("toClientSession tidak membocorkan field server-only", () => {
    const view = toClientSession({
      id: "x", userId: "u", sessionNumber: 1, title: "t", mode: "QUICK", categoryCode: null,
      difficulty: null, level: "SEMUA", questionCount: 1, seed: "s", status: "IN_PROGRESS", lastIndex: 0,
      durationSec: 0, timeLimitSec: null, activeSince: null, createdAt: new Date(), completedAt: null, result: null,
      items: [{ position: 0, questionId: "q", questionVersion: 1, type: "MULTIPLE_CHOICE",
        categoryCode: "reading", difficulty: "EASY", stem: "s", options: [{ label: "A", text: "a" }],
        answerKey: "A", explanation: "e", rubric: null, transcript: null, response: null, flagged: false }],
    });
    expect(JSON.stringify(view)).not.toMatch(/answerKey|isCorrect|"userId"|seed/);
  });
});

function makeBankAsRecords(): QuestionRecord[] {
  const cats = ["listening", "reading", "writing", "language_rules"];
  return Array.from({ length: 12 }, (_, i) => ({
    id: `r${i}`, version: 1, categoryCode: cats[i % cats.length]!, type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM" as const, level: "SMA_SMK" as const, transcript: null, status: "ACTIVE" as const, stem: `Soal ${i}`,
    options: [{ label: "A", text: "a", isCorrect: true }, { label: "B", text: "b", isCorrect: false }],
    answerKey: "A", explanation: "pembahasan", rubric: null, source: "tes", updatedAt: new Date(0),
  }));
}

describe("jumlah soal per mode", () => {
  it("mode QUICK selalu 3 soal walau form mengirim angka lain", async () => {
    const { svc } = setup(makeBankAsRecords());
    const s = await svc.createSession("u1", { mode: "QUICK", questionCount: 8 });
    expect(s.questionCount).toBe(3);
    expect(s.items).toHaveLength(3);
  });

  it("mode kustom memakai questionCount dari input", async () => {
    const { svc } = setup(makeBankAsRecords());
    const s = await svc.createSession("u1", { mode: "WEAK_QUESTIONS", questionCount: 5 });
    expect(s.items).toHaveLength(5);
  });
});
