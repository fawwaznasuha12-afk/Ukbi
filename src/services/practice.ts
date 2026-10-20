import { randomUUID } from "node:crypto";
import { selectQuestions } from "../domain/selection/select";
import type { CandidateQuestion, Difficulty } from "../domain/selection/types";
import { InsufficientQuestionsError } from "../domain/selection/types";
import type { Level } from "../domain/levels";
import { isTerminal, nextStatus, type SessionAction, type SessionStatus } from "../domain/session/status";
import { queryAndPaginate, type ListQuery, type Page } from "../domain/session/list";
import { computeStats, type DashboardStats } from "../domain/analytics";
import { scoreSession } from "../domain/scoring/score";
import { computeFinalScore } from "../domain/scoring/final";
import { evaluateEssay, type EssayEvaluation } from "../domain/scoring/rubric";
import { remainingSeconds } from "../domain/timer";
import { ALL_LEVELS, levelLabel, type SessionLevel } from "../domain/levels";
import { SIMULASI_SECTIONS, SIMULASI_TOTAL_SECONDS } from "../domain/simulasi";
import { createSessionInput, answerInput, fixedModeCount, type CreateSessionInput, type AnswerInput } from "../lib/validation/schemas";
import type { QuestionRepository, ExposureRepository, SessionRepository, SessionRecord, SnapshotItem } from "../repositories/types";

export class NotFoundError extends Error {
  constructor() {
    super("Sesi tidak ditemukan.");
    this.name = "NotFoundError";
  }
}

export class SessionLockedError extends Error {
  constructor(status: SessionStatus) {
    super(`Sesi sudah ${status === "COMPLETED" ? "selesai" : "dibatalkan"} dan tidak dapat diubah.`);
    this.name = "SessionLockedError";
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Waktu latihan habis. Sesi dikirim otomatis.");
    this.name = "SessionExpiredError";
  }
}

export interface Deps {
  questions: QuestionRepository;
  exposures: ExposureRepository;
  sessions: SessionRepository;
  now?: () => Date;
  newId?: () => string;
}

/** Batas waktu per mode. Mode lain tanpa batas. */
export const timeLimitByMode: Partial<Record<string, number>> = {
  SIMULASI: SIMULASI_TOTAL_SECONDS,
  QUICK: 10 * 60,
  STANDARD: 20 * 60,
  INTENSIVE: 45 * 60,
};

export interface ClientItem {
  position: number;
  questionId: string;
  type: string;
  categoryCode: string;
  stem: string;
  options: { label: string; text: string }[];
  response: string | null;
  flagged: boolean;
  isEssay: boolean;
  /** Sumber audio untuk soal listening. Null jika belum ada rekaman. */
  audioUrl: string | null;
  /** Transkrip hanya dikirim setelah sesi selesai. */
  transcript: string | null;
  explanation: string | null;
  correctLabel: string | null;
}

export interface ClientSession {
  id: string;
  sessionNumber: number;
  title: string;
  mode: string;
  categoryCode: string | null;
  status: SessionStatus;
  lastIndex: number;
  questionCount: number;
  durationSec: number;
  timeLimitSec: number | null;
  level: string;
  remainingSec: number | null;
  createdAt: Date;
  completedAt: Date | null;
  items: ClientItem[];
  result: unknown | null;
}

export function toClientSession(s: SessionRecord, now: Date = new Date()): ClientSession {
  const done = s.status === "COMPLETED";
  return {
    id: s.id,
    sessionNumber: s.sessionNumber,
    title: s.title,
    mode: s.mode,
    categoryCode: s.categoryCode,
    status: s.status,
    lastIndex: s.lastIndex,
    questionCount: s.questionCount,
    durationSec: s.durationSec,
    timeLimitSec: s.timeLimitSec,
    level: s.level,
    remainingSec: s.status === "IN_PROGRESS" || s.status === "NOT_STARTED" || s.status === "PAUSED"
      ? remainingSeconds(s, now)
      : null,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
    items: s.items.map<ClientItem>((i) => ({
      position: i.position,
      questionId: i.questionId,
      type: i.type,
      categoryCode: i.categoryCode,
      stem: i.stem,
      options: i.options,
      response: i.response,
      flagged: i.flagged,
      isEssay: i.answerKey === null && i.options.length === 0,
      audioUrl: i.categoryCode === "listening" && i.transcript ? `/audio/${i.questionId}.mp3` : null,
      transcript: done ? i.transcript : null,
      explanation: done ? i.explanation : null,
      correctLabel: done ? i.answerKey : null,
    })),
    result: done ? s.result : null,
  };
}

export function createPracticeService(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;

  async function load(userId: string, sessionId: string): Promise<SessionRecord> {
    const s = await deps.sessions.findForUser(userId, sessionId);
    if (!s) throw new NotFoundError();
    return s;
  }

  function accrue(s: SessionRecord, at: Date) {
    if (s.activeSince) {
      s.durationSec += Math.max(0, Math.round((at.getTime() - s.activeSince.getTime()) / 1000));
      s.activeSince = null;
    }
  }

  /** Kunci sesi: hitung nilai di server, simpan hasil, dan perbarui riwayat soal. */
  async function finalize(userId: string, s: SessionRecord, at: Date): Promise<SessionRecord> {
    accrue(s, at);
    s.status = nextStatus(s.status, "submit");
    s.completedAt = at;
    const objective = scoreSession(
      s.items.map((i) => ({
        questionId: i.questionId,
        categoryCode: i.categoryCode,
        answerKey: i.answerKey,
        response: i.response,
      })),
    );
    const essays = s.items
      .filter((i) => i.rubric !== null)
      .map((i) => ({
        position: i.position,
        questionId: i.questionId,
        evaluation: evaluateEssay(i.response, i.rubric!) as EssayEvaluation,
      }));
    const isCorrect = (i: SessionRecord["items"][number]) =>
      i.answerKey !== null && i.response !== null && i.response.trim().toUpperCase() === i.answerKey.trim().toUpperCase();
    const finalScore = computeFinalScore({
      objective: s.items.filter((i) => i.answerKey !== null).map((i) => ({ correct: isCorrect(i) })),
      essays: essays.map((e) => ({ score: e.evaluation.score })),
    });
    s.result = { ...objective, essays, finalScore: finalScore.finalScore, finalDetail: finalScore };
    await deps.sessions.save(s);

    for (const item of s.items) {
      const correct =
        item.answerKey === null || item.response === null
          ? null
          : item.response.trim().toUpperCase() === item.answerKey.trim().toUpperCase();
      await deps.exposures.recordOutcome(userId, item.questionId, correct);
    }
    return s;
  }

  /** Jika waktu habis saat sesi aktif, kirim otomatis. Mengembalikan true jika sudah dikirim. */
  async function expireIfNeeded(userId: string, s: SessionRecord, at: Date): Promise<boolean> {
    if (s.status !== "IN_PROGRESS") return false;
    if (remainingSeconds(s, at) !== 0) return false;
    await finalize(userId, s, at);
    return true;
  }

  async function transition(userId: string, sessionId: string, action: SessionAction): Promise<SessionRecord> {
    const s = await load(userId, sessionId);
    const at = now();
    if (await expireIfNeeded(userId, s, at)) return s;
    const to = nextStatus(s.status, action);
    if (to === "IN_PROGRESS") s.activeSince = at;
    if (to === "PAUSED") accrue(s, at);
    s.status = to;
    await deps.sessions.save(s);
    return s;
  }

  /** Simulasi Paket 1: tiap bagian diambil dari kategorinya, urut Mendengarkan → Kaidah → Membaca. */
  async function createSimulasi(userId: string, level: string) {
    const exposureMap = await deps.exposures.getForUser(userId);
    const items: SnapshotItem[] = [];
    const seed = newId();
    const at = now();
    for (const sec of SIMULASI_SECTIONS) {
      const bank = await deps.questions.listActive({
        categoryCode: sec.categoryCode,
        level: level === ALL_LEVELS ? undefined : (level as Level),
      });
      const candidates: CandidateQuestion[] = bank.map((q) => ({
        id: q.id, categoryCode: q.categoryCode, difficulty: q.difficulty, exposure: exposureMap.get(q.id),
      }));
      const count = Math.min(sec.target, candidates.length);
      if (count === 0) continue; // bagian tanpa soal dilewati, ditampilkan sebagai kekurangan
      const ids = selectQuestions(candidates, { count, seed: `${seed}-${sec.categoryCode}`, focus: "variety" });
      for (const id of ids) {
        const q = bank.find((x) => x.id === id)!;
        items.push({
          position: items.length, questionId: q.id, questionVersion: q.version, type: q.type,
          categoryCode: q.categoryCode, difficulty: q.difficulty, stem: q.stem,
          options: q.options.map(({ label, text }) => ({ label, text })), answerKey: q.answerKey,
          explanation: q.explanation, rubric: q.rubric, transcript: q.transcript, response: null, flagged: false,
        });
      }
    }
    if (items.length === 0) throw new InsufficientQuestionsError(1, 0);

    const created = await deps.sessions.createWithSnapshot({
      id: newId(), userId,
      title: `Simulasi Paket 1${level === ALL_LEVELS ? "" : ` ${levelLabel(level)}`} · ${at.toLocaleDateString("id-ID")}`,
      mode: "SIMULASI", categoryCode: null, difficulty: null, level: level as SessionLevel,
      questionCount: items.length, seed, status: "NOT_STARTED", lastIndex: 0, durationSec: 0,
      timeLimitSec: timeLimitByMode.SIMULASI ?? null, activeSince: null, createdAt: at, completedAt: null, items,
    });
    await deps.exposures.recordSeen(userId, items.map((i) => ({ questionId: i.questionId, seenAt: at })));
    return toClientSession(created, at);
  }

  return {
    async createSession(userId: string, raw: CreateSessionInput) {
      const parsed = createSessionInput.parse(raw);
      if (parsed.mode === "SIMULASI") return createSimulasi(userId, parsed.level);
      const input = { ...parsed, questionCount: fixedModeCount[parsed.mode] ?? parsed.questionCount };
      const filter = {
        categoryCode: input.mode === "CATEGORY" ? input.categoryCode : undefined,
        difficulty: input.mode === "DIFFICULTY" ? (input.difficulty as Difficulty) : undefined,
        level: input.level === ALL_LEVELS ? undefined : input.level,
      };
      const bank = await deps.questions.listActive(filter);
      const exposureMap = await deps.exposures.getForUser(userId);
      const candidates: CandidateQuestion[] = bank.map((q) => ({
        id: q.id,
        categoryCode: q.categoryCode,
        difficulty: q.difficulty,
        exposure: exposureMap.get(q.id),
      }));

      const seed = newId();
      const selectedIds = selectQuestions(candidates, {
        count: input.questionCount,
        seed,
        focus: input.mode === "WEAK_QUESTIONS" ? "weak" : "variety",
      });

      const byId = new Map(bank.map((q) => [q.id, q]));
      const at = now();
      const items: SnapshotItem[] = selectedIds.map((id, position) => {
        const q = byId.get(id)!;
        return {
          position,
          questionId: q.id,
          questionVersion: q.version,
          type: q.type,
          categoryCode: q.categoryCode,
          difficulty: q.difficulty,
          stem: q.stem,
          options: q.options.map(({ label, text }) => ({ label, text })),
          answerKey: q.answerKey,
          explanation: q.explanation,
          rubric: q.rubric,
          transcript: q.transcript,
          response: null,
          flagged: false,
        };
      });

      const created = await deps.sessions.createWithSnapshot({
        id: newId(),
        userId,
        title: `Latihan ${modeLabel(input.mode)}${input.level === ALL_LEVELS ? "" : ` ${levelLabel(input.level)}`} · ${at.toLocaleDateString("id-ID")}`,
        mode: input.mode,
        categoryCode: input.categoryCode ?? null,
        difficulty: input.difficulty ?? null,
        level: input.level,
        questionCount: items.length,
        seed,
        status: "NOT_STARTED",
        lastIndex: 0,
        durationSec: 0,
        timeLimitSec: timeLimitByMode[input.mode] ?? null,
        activeSince: null,
        createdAt: at,
        completedAt: null,
        items,
      });

      await deps.exposures.recordSeen(userId, items.map((i) => ({ questionId: i.questionId, seenAt: at })));
      return toClientSession(created, at);
    },

    async getSession(userId: string, sessionId: string) {
      const at = now();
      const s = await load(userId, sessionId);
      await expireIfNeeded(userId, s, at);
      return toClientSession(s, at);
    },

    async listPage(userId: string, query: ListQuery): Promise<Page<ClientSession>> {
      const rows = (await deps.sessions.listForUser(userId)).map((s) => toClientSession(s, now()));
      const page = queryAndPaginate(rows, query);
      return { ...page, items: page.items.map((s) => ({ ...s, items: [] })) };
    },

    async dashboard(userId: string): Promise<{ stats: DashboardStats; recent: ClientSession[] }> {
      const at = now();
      const rows = (await deps.sessions.listForUser(userId)).map((s) => toClientSession(s, at));
      // Rata-rata dan tren memakai skor akhir (semua soal yang dinilai), bukan hanya pilihan ganda.
      const pct = (r: ClientSession) => (r.result as { finalScore: number | null } | null)?.finalScore ?? null;
      const brk = (r: ClientSession) =>
        (r.result as { breakdown?: Record<string, { scored: number; correct: number; percentage: number | null }> } | null)?.breakdown;
      return {
        stats: computeStats(rows.map((r) => ({
          createdAt: r.createdAt,
          status: r.status,
          durationSec: r.durationSec,
          percentage: pct(r),
          breakdown: brk(r),
        }))),
        recent: rows.slice(0, 5).map((s) => ({ ...s, items: [] })),
      };
    },

    /** Ringkasan bank soal aktif per kategori. */
    async bankSummary() {
      const all = await deps.questions.listActive({});
      const byCat: Record<string, { total: number; byDifficulty: Record<string, number>; byLevel: Record<string, number> }> = {};
      for (const q of all) {
        const c = (byCat[q.categoryCode] ??= { total: 0, byDifficulty: {}, byLevel: {} });
        c.total++;
        c.byDifficulty[q.difficulty] = (c.byDifficulty[q.difficulty] ?? 0) + 1;
        c.byLevel[q.level] = (c.byLevel[q.level] ?? 0) + 1;
      }
      const byLevel: Record<string, number> = {};
      for (const q of all) byLevel[q.level] = (byLevel[q.level] ?? 0) + 1;
      return { total: all.length, byCategory: byCat, byLevel };
    },

    async start(userId: string, sessionId: string) {
      return toClientSession(await transition(userId, sessionId, "start"), now());
    },

    async pause(userId: string, sessionId: string) {
      return toClientSession(await transition(userId, sessionId, "pause"), now());
    },

    async resume(userId: string, sessionId: string) {
      return toClientSession(await transition(userId, sessionId, "resume"), now());
    },

    async saveAnswer(userId: string, sessionId: string, raw: AnswerInput) {
      const input = answerInput.parse(raw);
      const at = now();
      const s = await load(userId, sessionId);
      if (await expireIfNeeded(userId, s, at)) throw new SessionExpiredError();
      if (isTerminal(s.status)) throw new SessionLockedError(s.status);
      if (s.status !== "IN_PROGRESS") throw new Error("Mulai atau lanjutkan sesi terlebih dahulu.");
      const item = s.items.find((i) => i.position === input.position);
      if (!item) throw new Error("Posisi soal tidak valid.");
      item.response = input.response;
      if (input.flagged !== undefined) item.flagged = input.flagged;
      s.lastIndex = input.position;
      await deps.sessions.save(s);
      return toClientSession(s, at);
    },

    async submit(userId: string, sessionId: string) {
      const at = now();
      const s = await load(userId, sessionId);
      if (isTerminal(s.status)) throw new SessionLockedError(s.status);
      if (s.status === "NOT_STARTED") throw new Error("Mulai sesi terlebih dahulu.");
      await finalize(userId, s, at);
      return toClientSession(s, at);
    },
  };
}

export function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    SIMULASI: "Simulasi Paket 1",
    QUICK: "Cepat",
    STANDARD: "Standar",
    INTENSIVE: "Intensif",
    CATEGORY: "Kategori",
    DIFFICULTY: "Kesulitan",
    WEAK_QUESTIONS: "Soal Sering Salah",
  };
  return labels[mode] ?? mode;
}
