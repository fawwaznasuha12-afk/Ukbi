import { describe, expect, it } from "vitest";
import { buildBank } from "../src/domain/questions/bank";
import { loadBankFiles, BANK_DIR } from "../src/lib/bank-loader";
import { sampleQuestions } from "../prisma/seed/sample-questions";
import { createPracticeService } from "../src/services/practice";
import { MemoryExposureRepository, MemoryQuestionRepository, MemorySessionRepository } from "../src/repositories/memory";
import { SIMULASI_SECTIONS, SIMULASI_TOTAL_SECONDS, simulasiShortfall } from "../src/domain/simulasi";
import type { QuestionRecord } from "../src/repositories/types";

const sampleView = sampleQuestions.map((q) => ({ id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status }));
const bankRecords: QuestionRecord[] = [...buildBank(loadBankFiles(BANK_DIR), sampleView, new Date(0)).records, ...sampleQuestions];

function svcWith(records: QuestionRecord[]) {
  let n = 0;
  return createPracticeService({
    questions: new MemoryQuestionRepository(structuredClone(records)),
    exposures: new MemoryExposureRepository(),
    sessions: new MemorySessionRepository(),
    newId: () => `s-${++n}`,
  });
}

describe("simulasi Paket 1", () => {
  it("bank lengkap: 105 soal, urut Mendengarkan → Kaidah → Membaca, durasi 100 menit", async () => {
    const svc = svcWith(bankRecords);
    const s = await svc.createSession("u1", { mode: "SIMULASI", level: "SEMUA", questionCount: 1 });
    expect(s.questionCount).toBe(105);
    expect(s.items).toHaveLength(105);
    expect(s.timeLimitSec).toBe(SIMULASI_TOTAL_SECONDS);
    expect(SIMULASI_TOTAL_SECONDS / 60).toBe(100);
    const order = s.items.map((i) => i.categoryCode);
    expect(order.slice(0, 40).every((c) => c === "listening")).toBe(true);
    expect(order.slice(40, 65).every((c) => c === "language_rules")).toBe(true);
    expect(order.slice(65).every((c) => c === "reading")).toBe(true);
  });

  it("tidak ada soal ganda dalam satu simulasi", async () => {
    const svc = svcWith(bankRecords);
    const s = await svc.createSession("u1", { mode: "SIMULASI", level: "SEMUA", questionCount: 1 });
    expect(new Set(s.items.map((i) => i.questionId)).size).toBe(s.items.length);
  });

  it("bank kurang: simulasi tetap jalan dengan yang ada, dan kekurangan terdeteksi", async () => {
    const withoutListening = bankRecords.filter((r) => r.categoryCode !== "listening" || r.id !== bankRecords.find((x) => x.categoryCode === "listening")!.id);
    const svc = svcWith(withoutListening);
    const s = await svc.createSession("u1", { mode: "SIMULASI", level: "SEMUA", questionCount: 1 });
    const have = s.items.filter((i) => i.categoryCode === "listening").length;
    expect(have).toBeLessThan(40);
    const short = simulasiShortfall({ listening: have, language_rules: 25, reading: 40 });
    expect(short).toEqual([{ label: "Mendengarkan", have, target: 40 }]);
  });

  it("simulasi per jenjang: hanya soal jenjang itu", async () => {
    const svc = svcWith(bankRecords);
    const s = await svc.createSession("u1", { mode: "SIMULASI", level: "SD", questionCount: 1 });
    const sdIds = new Set(bankRecords.filter((r) => r.level === "SD").map((r) => r.id));
    expect(s.items.every((i) => sdIds.has(i.questionId))).toBe(true);
  });

  it("bagian target sesuai format sumber: 40 / 25 / 40", () => {
    expect(SIMULASI_SECTIONS.map((x) => x.target)).toEqual([40, 25, 40]);
    expect(simulasiShortfall({ listening: 40, language_rules: 25, reading: 40 })).toEqual([]);
  });
});
