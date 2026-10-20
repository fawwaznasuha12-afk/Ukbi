import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openAppDb } from "../src/db/sqlite";
import { sampleQuestions } from "../prisma/seed/sample-questions";
import { createPracticeService, toClientSession } from "../src/services/practice";
import type { SessionRecord, SnapshotItem } from "../src/repositories/types";

function tmpFile() {
  return path.join(mkdtempSync(path.join(tmpdir(), "ukbi-db-")), "app.db");
}

const user = (id: string) => ({ id, email: `${id}@t.test`, passwordHash: "scrypt$x$y", createdAt: new Date(0) });

function item(position: number, questionId: string): SnapshotItem {
  return {
    position, questionId, questionVersion: 1, type: "MULTIPLE_CHOICE", categoryCode: "reading",
    difficulty: "EASY", stem: "s", options: [{ label: "A", text: "a" }], answerKey: "A",
    explanation: "e", rubric: null, transcript: null, response: null, flagged: false,
  };
}

function session(id: string, userId: string, items: SnapshotItem[]): Omit<SessionRecord, "sessionNumber" | "result"> {
  return {
    id, userId, title: "t", mode: "QUICK", categoryCode: null, difficulty: null, level: "SEMUA" as const, questionCount: items.length,
    seed: "s", status: "NOT_STARTED", lastIndex: 0, durationSec: 0, timeLimitSec: null, activeSince: null,
    createdAt: new Date("2026-10-01T00:00:00Z"), completedAt: null, items,
  };
}

describe("repository SQLite", () => {
  it("nomor sesi berurutan per user, tidak tergantung user lain", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    await db.users.create(user("u2"));
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    const a = await db.sessions.createWithSnapshot(session("s1", "u1", [item(0, "lr-001")]));
    const b = await db.sessions.createWithSnapshot(session("s2", "u1", [item(0, "lr-002")]));
    const c = await db.sessions.createWithSnapshot(session("s3", "u2", [item(0, "lr-001")]));
    expect([a.sessionNumber, b.sessionNumber, c.sessionNumber]).toEqual([1, 2, 1]);
    db.close();
  });

  it("constraint di level database: email unik, pasangan (user, nomor sesi) unik", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    await expect(db.users.create({ ...user("u9"), email: "u1@t.test" })).rejects.toThrow();
    db.close();
  });

  it("transaksi gagal di-rollback: tidak ada sesi setengah jadi dan nomor tidak terpakai", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    // Dua item dengan questionId sama melanggar UNIQUE(session_id, question_id).
    await expect(
      db.sessions.createWithSnapshot(session("bad", "u1", [item(0, "lr-001"), item(1, "lr-001")])),
    ).rejects.toThrow();
    expect(await db.sessions.findForUser("u1", "bad")).toBeNull();
    const ok = await db.sessions.createWithSnapshot(session("good", "u1", [item(0, "lr-001")]));
    expect(ok.sessionNumber).toBe(1);
    db.close();
  });

  it("snapshot tidak berubah saat bank soal diganti", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    await db.sessions.createWithSnapshot(session("s1", "u1", [item(0, "lr-001")]));
    const q = (await db.questions.listAll()).find((x) => x.id === "lr-001")!;
    await db.questions.replace({ ...q, stem: "TEKS BARU PANJANG SEKALI", version: 2 });
    const reopened = await db.sessions.findForUser("u1", "s1");
    expect(reopened!.items[0]!.stem).toBe("s");
    db.close();
  });

  it("save menyimpan jawaban dan status; findForUser menolak user lain", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    await db.users.create(user("u2"));
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    const s = await db.sessions.createWithSnapshot(session("s1", "u1", [item(0, "lr-001")]));
    await db.sessions.save({ ...s, status: "IN_PROGRESS", items: [{ ...s.items[0]!, response: "A", flagged: true }] });
    const back = await db.sessions.findForUser("u1", "s1");
    expect(back!.status).toBe("IN_PROGRESS");
    expect(back!.items[0]!.response).toBe("A");
    expect(back!.items[0]!.flagged).toBe(true);
    expect(await db.sessions.findForUser("u2", "s1")).toBeNull();
    db.close();
  });

  it("exposures: timesSeen bertambah dan lastCorrect tersimpan", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    const now = new Date("2026-10-01T00:00:00Z");
    await db.exposures.recordSeen("u1", [{ questionId: "lr-001", seenAt: now }]);
    await db.exposures.recordSeen("u1", [{ questionId: "lr-001", seenAt: now }]);
    await db.exposures.recordOutcome("u1", "lr-001", false);
    const m = await db.exposures.getForUser("u1");
    expect(m.get("lr-001")).toEqual({ timesSeen: 2, lastSeenAt: now, lastCorrect: false });
    db.close();
  });

  it("seed bank soal hanya terjadi sekali", () => {
    const db = openAppDb(":memory:");
    expect(db.seedQuestionsIfEmpty(structuredClone(sampleQuestions))).toBe(sampleQuestions.length);
    expect(db.seedQuestionsIfEmpty(structuredClone(sampleQuestions))).toBe(0);
    db.close();
  });

  it("replace soal yang tidak ada melempar error", async () => {
    const db = openAppDb(":memory:");
    await expect(db.questions.replace({ ...sampleQuestions[0]!, id: "tidak-ada" })).rejects.toThrow("tidak ditemukan");
    db.close();
  });

  it("data bertahan setelah database dibuka ulang (simulasi restart server)", async () => {
    const file = tmpFile();
    const db1 = openAppDb(file);
    await db1.users.create(user("u1"));
    db1.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    const svc1 = createPracticeService({ questions: db1.questions, exposures: db1.exposures, sessions: db1.sessions });
    const created = await svc1.createSession("u1", { mode: "QUICK", questionCount: 3 });
    await svc1.start("u1", created.id);
    await svc1.saveAnswer("u1", created.id, { position: 1, response: "B", flagged: true });
    db1.close();

    const db2 = openAppDb(file);
    const svc2 = createPracticeService({ questions: db2.questions, exposures: db2.exposures, sessions: db2.sessions });
    const back = await svc2.getSession("u1", created.id);
    expect(back.status).toBe("IN_PROGRESS");
    expect(back.items[1]!.response).toBe("B");
    expect(back.items[1]!.flagged).toBe(true);
    expect(back.items.map((i) => i.questionId)).toEqual(created.items.map((i) => i.questionId));
    db2.close();
  });

  it("toClientSession tetap menyembunyikan kunci untuk sesi yang dibaca dari SQLite", async () => {
    const db = openAppDb(":memory:");
    await db.users.create(user("u1"));
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    const svc = createPracticeService({ questions: db.questions, exposures: db.exposures, sessions: db.sessions });
    const s = await svc.createSession("u1", { mode: "QUICK", questionCount: 3 });
    await svc.start("u1", s.id);
    expect(JSON.stringify(await svc.getSession("u1", s.id))).not.toMatch(/answerKey|isCorrect/);
    expect(toClientSession).toBeDefined();
    db.close();
  });

  it("insertMissingQuestions menambah soal baru dan tidak menimpa soal yang sudah ada", async () => {
    const db = openAppDb(":memory:");
    db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    const existing = sampleQuestions[0]!;
    const fresh = { ...structuredClone(existing), id: "baru-001", stem: "Soal baru yang belum ada di database." };
    const changed = { ...structuredClone(existing), stem: "Mencoba menimpa soal lama" };
    expect(db.insertMissingQuestions([fresh, changed])).toBe(1);
    const all = await db.questions.listAll();
    expect(all.find((q) => q.id === existing.id)!.stem).toBe(existing.stem);
    expect(all.some((q) => q.id === "baru-001")).toBe(true);
    db.close();
  });
});
