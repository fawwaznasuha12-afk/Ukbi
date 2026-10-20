import { describe, expect, it } from "vitest";
import { createAuthService, AuthError, SESSION_TTL_MS } from "../src/services/auth";
import { createQuestionAdminService, QuestionValidationError } from "../src/services/question-admin";
import { createPracticeService, SessionExpiredError, timeLimitByMode } from "../src/services/practice";
import { MemoryAuthTokenRepository, MemoryExposureRepository, MemoryQuestionRepository, MemorySessionRepository, MemoryUserRepository } from "../src/repositories/memory";
import { sampleQuestions } from "../prisma/seed/sample-questions";

function clock(start: string) {
  let t = new Date(start).getTime();
  return { now: () => new Date(t), advance: (ms: number) => { t += ms; } };
}

function authSetup(c = clock("2026-10-01T08:00:00Z")) {
  let n = 0;
  const users = new MemoryUserRepository();
  const tokens = new MemoryAuthTokenRepository();
  const svc = createAuthService({ users, tokens, now: c.now, newId: () => `u${++n}` });
  return { svc, users, tokens, c };
}

describe("auth service", () => {
  it("daftar lalu masuk dengan sandi benar; token me-resolve ke user yang sama", async () => {
    const { svc } = authSetup();
    const reg = await svc.register("Budi@Example.com", "sandi-kuat-1");
    const login = await svc.login("budi@example.com", "sandi-kuat-1");
    expect(await svc.resolve(login.token)).toBe(reg.userId);
  });

  it("sandi salah ditolak dengan pesan generik (tidak membocorkan email)", async () => {
    const { svc } = authSetup();
    await svc.register("a@b.co", "sandi-kuat-1");
    await expect(svc.login("a@b.co", "salah-salah")).rejects.toThrow("Email atau sandi salah.");
    await expect(svc.login("tidakada@b.co", "apa-saja-1")).rejects.toThrow("Email atau sandi salah.");
  });

  it("email terdaftar tidak bisa didaftar dua kali", async () => {
    const { svc } = authSetup();
    await svc.register("a@b.co", "sandi-kuat-1");
    await expect(svc.register("A@B.co", "sandi-lain-2")).rejects.toThrow("Email sudah terdaftar.");
  });

  it("validasi: format email dan panjang sandi", async () => {
    const { svc } = authSetup();
    await expect(svc.register("bukan-email", "sandi-kuat-1")).rejects.toBeInstanceOf(AuthError);
    await expect(svc.register("a@b.co", "pendek")).rejects.toThrow("Sandi harus 8–200 karakter.");
  });

  it("setelah 5 kali gagal, akun dikunci sementara walau sandi benar", async () => {
    const { svc } = authSetup();
    await svc.register("a@b.co", "sandi-kuat-1");
    for (let i = 0; i < 5; i++) await expect(svc.login("a@b.co", "salah")).rejects.toThrow();
    await expect(svc.login("a@b.co", "sandi-kuat-1")).rejects.toThrow("Terlalu banyak percobaan");
  });

  it("token kedaluwarsa setelah 14 hari", async () => {
    const c = clock("2026-10-01T08:00:00Z");
    const { svc } = authSetup(c);
    const { token } = await svc.register("a@b.co", "sandi-kuat-1");
    c.advance(SESSION_TTL_MS + 1000);
    expect(await svc.resolve(token)).toBeNull();
  });

  it("logout mencabut token", async () => {
    const { svc } = authSetup();
    const { token } = await svc.register("a@b.co", "sandi-kuat-1");
    await svc.logout(token);
    expect(await svc.resolve(token)).toBeNull();
  });

  it("token tidak pernah disimpan dalam bentuk mentah", async () => {
    const { svc, tokens } = authSetup();
    const { token } = await svc.register("a@b.co", "sandi-kuat-1");
    const stored = JSON.stringify(tokens.all());
    expect(stored).not.toContain(token);
  });
});

function adminSetup() {
  let n = 0;
  const repo = new MemoryQuestionRepository(structuredClone(sampleQuestions));
  return { repo, svc: createQuestionAdminService({ questions: repo, newId: () => `new-${++n}`, now: () => new Date(0) }) };
}

const goodDraft = {
  categoryCode: "listening",
  type: "MULTIPLE_CHOICE",
  difficulty: "EASY",
  level: "SD",
  transcript: "Pertemuan dimulai pukul sembilan pagi.",
  stem: "Transkrip: Pertemuan dimulai pukul sembilan pagi. Jam berapa dimulai?",
  options: [{ text: "Pukul sembilan" }, { text: "Pukul sepuluh" }],
  answerKey: "A",
  explanation: "Penutur menyebut pukul sembilan.",
  rubric: null,
  source: "admin",
};

describe("question admin service", () => {
  it("membuat soal valid dengan versi 1 dan status aktif", async () => {
    const { svc, repo } = adminSetup();
    const q = await svc.create(goodDraft);
    expect(q.version).toBe(1);
    expect(q.status).toBe("ACTIVE");
    expect((await repo.listAll()).some((x) => x.id === q.id)).toBe(true);
  });

  it("menolak soal duplikat dengan pesan jelas", async () => {
    const { svc } = adminSetup();
    const orig = sampleQuestions[0]!;
    const dup = {
      ...goodDraft, categoryCode: orig.categoryCode, level: orig.level, transcript: null,
      stem: orig.stem, options: orig.options.map((o) => ({ text: o.text })), answerKey: orig.answerKey,
    };
    await expect(svc.create(dup)).rejects.toBeInstanceOf(QuestionValidationError);
  });

  it("edit membuat versi baru dan tidak menduplikasi diri sendiri", async () => {
    const { svc } = adminSetup();
    const q = await svc.create(goodDraft);
    const edited = await svc.update(q.id, { ...goodDraft, explanation: "Pembahasan yang diperbaiki." });
    expect(edited.version).toBe(2);
    expect(edited.explanation).toBe("Pembahasan yang diperbaiki.");
  });

  it("arsip menyembunyikan soal dari seleksi tapi tetap ada di daftar admin", async () => {
    const { svc, repo } = adminSetup();
    const q = await svc.create(goodDraft);
    await svc.setArchived(q.id, true);
    const active = await repo.listActive({});
    expect(active.some((x) => x.id === q.id)).toBe(false);
    expect((await svc.list()).find((x) => x.id === q.id)?.status).toBe("ARCHIVED");
  });
});

describe("sesi: timer dan esai", () => {
  function sessionSetup(c = clock("2026-10-01T08:00:00Z")) {
    let n = 0;
    const questions = new MemoryQuestionRepository(structuredClone(sampleQuestions));
    const sessions = new MemorySessionRepository();
    const exposures = new MemoryExposureRepository();
    const svc = createPracticeService({ questions, exposures, sessions, now: c.now, newId: () => `id-${++n}` });
    return { svc, c, sessions };
  }

  it("mode cepat memberi batas waktu 10 menit, mode kategori tanpa batas", async () => {
    const { svc } = sessionSetup();
    const q = await svc.createSession("u1", { mode: "QUICK", questionCount: 3 });
    expect(q.timeLimitSec).toBe(timeLimitByMode.QUICK);
    const c = await svc.createSession("u1", { mode: "CATEGORY", categoryCode: "reading", questionCount: 2 });
    expect(c.timeLimitSec).toBeNull();
  });

  it("waktu habis saat dibuka: sesi dikirim otomatis dan jawaban terakhir tetap dinilai", async () => {
    const { svc, c } = sessionSetup();
    const s = await svc.createSession("u1", { mode: "QUICK", questionCount: 3 });
    await svc.start("u1", s.id);
    const first = s.items[0]!;
    await svc.saveAnswer("u1", s.id, { position: 0, response: first.correctLabel ?? "A" });
    c.advance((timeLimitByMode.QUICK! + 5) * 1000);
    const after = await svc.getSession("u1", s.id);
    expect(after.status).toBe("COMPLETED");
    expect(after.result).not.toBeNull();
  });

  it("menjawab setelah waktu habis ditolak dan sesi langsung dikirim", async () => {
    const { svc, c } = sessionSetup();
    const s = await svc.createSession("u1", { mode: "QUICK", questionCount: 3 });
    await svc.start("u1", s.id);
    c.advance((timeLimitByMode.QUICK! + 1) * 1000);
    await expect(svc.saveAnswer("u1", s.id, { position: 0, response: "A" })).rejects.toBeInstanceOf(SessionExpiredError);
    expect((await svc.getSession("u1", s.id)).status).toBe("COMPLETED");
  });

  it("waktu tidak berjalan saat sesi dijeda", async () => {
    const { svc, c } = sessionSetup();
    const s = await svc.createSession("u1", { mode: "QUICK", questionCount: 3 });
    await svc.start("u1", s.id);
    c.advance(5 * 60 * 1000);
    await svc.pause("u1", s.id);
    c.advance(60 * 60 * 1000);
    const view = await svc.getSession("u1", s.id);
    expect(view.status).toBe("PAUSED");
    expect(view.remainingSec).toBe(timeLimitByMode.QUICK! - 300);
  });

  it("esai dinilai dengan rubrik: hasil ada di result dan tidak masuk persentase objektif", async () => {
    const { svc } = (() => {
      let n = 0;
      const essay = { ...structuredClone(sampleQuestions).find((q) => q.id === "wr-001")! };
      const questions = new MemoryQuestionRepository([essay]);
      const sessions = new MemorySessionRepository();
      const exposures = new MemoryExposureRepository();
      return { svc: createPracticeService({ questions, exposures, sessions, newId: () => `e-${++n}` }) };
    })();
    const s = await svc.createSession("u1", { mode: "WEAK_QUESTIONS", questionCount: 1 });
    await svc.start("u1", s.id);
    await svc.saveAnswer("u1", s.id, { position: 0, response: "Membaca itu penting. Dengan membaca, kosakata bertambah. Kita jadi lebih paham dunia. Maka rajin membaca itu baik." });
    const done = await svc.submit("u1", s.id);
    const result = done.result as { percentage: number | null; essays: { evaluation: { score: number; criteria: { id: string; passed: boolean }[] } }[] };
    expect(result.percentage).toBeNull();
    expect(result.essays).toHaveLength(1);
    expect(result.essays[0]!.evaluation.score).toBeGreaterThan(0);
    expect(result.essays[0]!.evaluation.criteria.find((c) => c.id === "kw-membaca")?.passed).toBe(true);
  });

  it("hasil sesi punya skor akhir yang memasukkan esai", async () => {
    let n = 0;
    const essay = structuredClone(sampleQuestions).find((q) => q.id === "wr-001")!;
    const objective = structuredClone(sampleQuestions).find((q) => q.id === "lr-001")!;
    const svc = createPracticeService({
      questions: new MemoryQuestionRepository([essay, objective]),
      exposures: new MemoryExposureRepository(),
      sessions: new MemorySessionRepository(),
      newId: () => `f-${++n}`,
    });
    const s = await svc.createSession("u1", { mode: "WEAK_QUESTIONS", questionCount: 2 });
    await svc.start("u1", s.id);
    const objIdx = s.items.findIndex((i) => i.questionId === "lr-001");
    await svc.saveAnswer("u1", s.id, { position: objIdx, response: "B" });
    const esIdx = s.items.findIndex((i) => i.questionId === "wr-001");
    await svc.saveAnswer("u1", s.id, { position: esIdx, response: "Membaca itu penting. Dengan membaca, kosakata bertambah. Kita paham dunia. Maka membaca itu baik." });
    const done = await svc.submit("u1", s.id);
    const r = done.result as { finalScore: number | null; percentage: number | null };
    expect(r.percentage).toBe(100);
    expect(r.finalScore).not.toBeNull();
    expect(r.finalScore!).toBeLessThan(100);
    expect(r.finalScore!).toBeGreaterThan(0);
  });
});

describe("transkrip listening tidak bocor sebelum sesi selesai", () => {
  it("transkrip dan audioUrl: audio ada selama mengerjakan, transkrip baru tampil setelah dikirim", async () => {
    let n = 0;
    const listen = {
      ...structuredClone(sampleQuestions).find((q) => q.id === "lr-001")!,
      id: "li-1", categoryCode: "listening", transcript: "Rapat dipindah ke hari Kamis.", stem: "Kapan rapat dilaksanakan?",
    };
    const svc = createPracticeService({
      questions: new MemoryQuestionRepository([listen]),
      exposures: new MemoryExposureRepository(),
      sessions: new MemorySessionRepository(),
      newId: () => `t-${++n}`,
    });
    const s = await svc.createSession("u1", { mode: "CATEGORY", categoryCode: "listening", questionCount: 1 });
    await svc.start("u1", s.id);
    const running = await svc.getSession("u1", s.id);
    expect(running.items[0]!.audioUrl).toBe("/audio/li-1.mp3");
    expect(running.items[0]!.transcript).toBeNull();
    expect(JSON.stringify(running)).not.toContain("Rapat dipindah");

    const done = await svc.submit("u1", s.id);
    expect(done.items[0]!.transcript).toBe("Rapat dipindah ke hari Kamis.");
  });
});
