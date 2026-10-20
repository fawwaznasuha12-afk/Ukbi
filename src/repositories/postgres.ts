import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../db/index";
import {
  authTokens,
  exposures,
  questions,
  sessionItems,
  sessions,
  users,
} from "../../db/schema";
import type {
  AuthTokenRecord,
  AuthTokenRepository,
  ExposureRecord,
  ExposureRepository,
  QuestionAdminRepository,
  QuestionRecord,
  QuestionRepository,
  SessionRecord,
  SessionRepository,
  SnapshotItem,
  UserRecord,
  UserRepository,
} from "./types";
import type { Difficulty } from "../domain/selection/types";
import type { Rubric } from "../domain/scoring/rubric";
import { isLevel, type Level } from "../domain/levels";

/**
 * Implementasi repository di atas Postgres (Netlify Database) lewat Drizzle ORM.
 * Semantik dijaga sama dengan src/db/sqlite.ts, termasuk transaksi untuk
 * penulisan sesi dan penguncian per pengguna agar nomor sesi tidak bentrok.
 */

/** Parser timestamptz adapter bisa mengembalikan Date atau string. */
const toDate = (v: unknown): Date | null =>
  v === null || v === undefined ? null : v instanceof Date ? v : new Date(String(v));

const mapUser = (r: typeof users.$inferSelect): UserRecord => ({
  id: r.id,
  email: r.email,
  passwordHash: r.passwordHash,
  createdAt: toDate(r.createdAt)!,
});

const mapQuestion = (r: typeof questions.$inferSelect): QuestionRecord => ({
  id: r.id,
  version: r.version,
  categoryCode: r.categoryCode,
  type: r.type,
  difficulty: r.difficulty as Difficulty,
  level: (isLevel(r.level) ? r.level : "SMA_SMK") as Level,
  stem: r.stem,
  options: r.options,
  answerKey: r.answerKey ?? null,
  explanation: r.explanation,
  rubric: (r.rubric ?? null) as Rubric | null,
  transcript: r.transcript ?? null,
  source: r.source,
  status: r.status as "ACTIVE" | "ARCHIVED",
  updatedAt: toDate(r.updatedAt)!,
});

const questionValues = (q: QuestionRecord) => ({
  id: q.id,
  version: q.version,
  categoryCode: q.categoryCode,
  type: q.type,
  difficulty: q.difficulty,
  stem: q.stem,
  options: q.options,
  answerKey: q.answerKey,
  explanation: q.explanation,
  rubric: q.rubric,
  source: q.source,
  level: q.level,
  transcript: q.transcript,
  status: q.status,
  updatedAt: q.updatedAt,
});

const mapItem = (r: typeof sessionItems.$inferSelect): SnapshotItem => ({
  position: r.position,
  questionId: r.questionId,
  questionVersion: r.questionVersion,
  type: r.type,
  categoryCode: r.categoryCode,
  difficulty: r.difficulty as Difficulty,
  stem: r.stem,
  options: r.options,
  answerKey: r.answerKey ?? null,
  explanation: r.explanation,
  rubric: (r.rubric ?? null) as Rubric | null,
  transcript: r.transcript ?? null,
  response: r.response ?? null,
  flagged: r.flagged,
});

const mapToken = (r: typeof authTokens.$inferSelect): AuthTokenRecord => ({
  tokenHash: r.tokenHash,
  userId: r.userId,
  expiresAt: toDate(r.expiresAt)!,
});

export interface PostgresRepositories {
  users: UserRepository;
  tokens: AuthTokenRepository;
  questions: QuestionRepository & QuestionAdminRepository;
  sessions: SessionRepository;
  exposures: ExposureRepository;
  /** Mengisi bank soal awal hanya jika tabel questions masih kosong. */
  seedQuestionsIfEmpty(list: QuestionRecord[]): Promise<number>;
  /** Menambahkan soal yang belum ada (id sama dilewati). Mengembalikan jumlah yang benar-benar masuk. */
  insertMissingQuestions(list: QuestionRecord[]): Promise<number>;
}

export function createPostgresRepositories(db: Db): PostgresRepositories {
  // ---------- users & tokens ----------
  const userRepo: UserRepository = {
    async findByEmail(email) {
      const [r] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return r ? mapUser(r) : null;
    },
    async findById(id) {
      const [r] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return r ? mapUser(r) : null;
    },
    async create(u) {
      await db.insert(users).values({ id: u.id, email: u.email, passwordHash: u.passwordHash, createdAt: u.createdAt });
    },
  };

  const tokenRepo: AuthTokenRepository = {
    async add(rec) {
      await db.insert(authTokens).values({ tokenHash: rec.tokenHash, userId: rec.userId, expiresAt: rec.expiresAt });
    },
    async find(tokenHash) {
      const [r] = await db.select().from(authTokens).where(eq(authTokens.tokenHash, tokenHash)).limit(1);
      return r ? mapToken(r) : null;
    },
    async remove(tokenHash) {
      await db.delete(authTokens).where(eq(authTokens.tokenHash, tokenHash));
    },
  };

  // ---------- questions ----------
  const questionRepo: QuestionRepository & QuestionAdminRepository = {
    async listActive(filter) {
      const rows = await db.select().from(questions).where(eq(questions.status, "ACTIVE"));
      return rows.map(mapQuestion).filter(
        (q) =>
          (!filter.categoryCode || q.categoryCode === filter.categoryCode) &&
          (!filter.difficulty || q.difficulty === filter.difficulty) &&
          (!filter.level || q.level === filter.level),
      );
    },
    async listAll() {
      const rows = await db.select().from(questions).orderBy(questions.id);
      return rows.map(mapQuestion);
    },
    async create(q) {
      await db.insert(questions).values(questionValues(q));
    },
    async replace(q) {
      const updated = await db
        .update(questions)
        .set(questionValues(q))
        .where(eq(questions.id, q.id))
        .returning({ id: questions.id });
      if (updated.length === 0) throw new Error(`Soal ${q.id} tidak ditemukan`);
    },
  };

  // ---------- sessions ----------
  async function loadItems(sessionId: string): Promise<SnapshotItem[]> {
    const rows = await db
      .select()
      .from(sessionItems)
      .where(eq(sessionItems.sessionId, sessionId))
      .orderBy(sessionItems.position);
    return rows.map(mapItem);
  }

  const mapSession = (r: typeof sessions.$inferSelect, items: SnapshotItem[]): SessionRecord => ({
    id: r.id,
    userId: r.userId,
    sessionNumber: r.sessionNumber,
    title: r.title,
    mode: r.mode,
    categoryCode: r.categoryCode ?? null,
    difficulty: (r.difficulty ?? null) as Difficulty | null,
    level: (r.level === "SEMUA" ? "SEMUA" : isLevel(r.level) ? r.level : "SEMUA") as SessionRecord["level"],
    questionCount: r.questionCount,
    seed: r.seed,
    status: r.status as SessionRecord["status"],
    lastIndex: r.lastIndex,
    durationSec: r.durationSec,
    timeLimitSec: r.timeLimitSec ?? null,
    activeSince: toDate(r.activeSince),
    createdAt: toDate(r.createdAt)!,
    completedAt: toDate(r.completedAt),
    result: r.result ?? null,
    items,
  });

  async function findSession(userId: string, sessionId: string): Promise<SessionRecord | null> {
    const [r] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);
    return r ? mapSession(r, await loadItems(r.id)) : null;
  }

  const sessionRepo: SessionRepository = {
    async createWithSnapshot(input) {
      const record = await db.transaction(async (tx) => {
        // Kunci per pengguna supaya nomor sesi berurutan meski ada permintaan bersamaan.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
        const [m] = await tx
          .select({ n: sql<number>`coalesce(max(${sessions.sessionNumber}), 0)::int` })
          .from(sessions)
          .where(eq(sessions.userId, input.userId));
        const sessionNumber = Number(m?.n ?? 0) + 1;
        const [created] = await tx
          .insert(sessions)
          .values({
            id: input.id,
            userId: input.userId,
            sessionNumber,
            title: input.title,
            mode: input.mode,
            categoryCode: input.categoryCode,
            difficulty: input.difficulty,
            level: input.level,
            questionCount: input.questionCount,
            seed: input.seed,
            status: input.status,
            lastIndex: input.lastIndex,
            durationSec: input.durationSec,
            timeLimitSec: input.timeLimitSec,
            activeSince: input.activeSince,
            createdAt: input.createdAt,
            completedAt: input.completedAt,
            result: null,
          })
          .returning();
        if (input.items.length > 0) {
          await tx.insert(sessionItems).values(
            input.items.map((it) => ({
              sessionId: input.id,
              position: it.position,
              questionId: it.questionId,
              questionVersion: it.questionVersion,
              type: it.type,
              categoryCode: it.categoryCode,
              difficulty: it.difficulty,
              stem: it.stem,
              options: it.options,
              answerKey: it.answerKey,
              explanation: it.explanation,
              rubric: it.rubric,
              transcript: it.transcript,
              response: it.response,
              flagged: it.flagged,
            })),
          );
        }
        return mapSession(created!, input.items.map((it) => structuredClone(it)));
      });
      return record;
    },
    findForUser: (userId, sessionId) => findSession(userId, sessionId),
    async listForUser(userId) {
      const rows = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.createdAt), desc(sessions.id));
      const out: SessionRecord[] = [];
      for (const r of rows) out.push(mapSession(r, await loadItems(r.id)));
      return out;
    },
    async save(rec) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(sessions)
          .set({
            status: rec.status,
            lastIndex: rec.lastIndex,
            durationSec: rec.durationSec,
            activeSince: rec.activeSince,
            completedAt: rec.completedAt,
            result: rec.result ?? null,
          })
          .where(and(eq(sessions.id, rec.id), eq(sessions.userId, rec.userId)))
          .returning({ id: sessions.id });
        if (updated.length === 0) throw new Error("Sesi tidak ditemukan");
        for (const it of rec.items) {
          await tx
            .update(sessionItems)
            .set({ response: it.response, flagged: it.flagged })
            .where(and(eq(sessionItems.sessionId, rec.id), eq(sessionItems.position, it.position)));
        }
      });
    },
  };

  // ---------- exposures ----------
  const exposureRepo: ExposureRepository = {
    async getForUser(userId) {
      const rows = await db.select().from(exposures).where(eq(exposures.userId, userId));
      const m = new Map<string, ExposureRecord>();
      for (const r of rows) {
        m.set(r.questionId, {
          timesSeen: r.timesSeen,
          lastSeenAt: toDate(r.lastSeenAt),
          lastCorrect: r.lastCorrect,
        });
      }
      return m;
    },
    async recordSeen(userId, seen) {
      if (seen.length === 0) return;
      await db
        .insert(exposures)
        .values(
          seen.map((s) => ({
            userId,
            questionId: s.questionId,
            timesSeen: 1,
            lastSeenAt: s.seenAt,
            lastCorrect: null,
          })),
        )
        .onConflictDoUpdate({
          target: [exposures.userId, exposures.questionId],
          set: {
            timesSeen: sql`${exposures.timesSeen} + 1`,
            lastSeenAt: sql`excluded.last_seen_at`,
          },
        });
    },
    async recordOutcome(userId, questionId, correct) {
      await db
        .update(exposures)
        .set({ lastCorrect: correct })
        .where(and(eq(exposures.userId, userId), eq(exposures.questionId, questionId)));
    },
  };

  // ---------- seeding ----------
  async function seedQuestionsIfEmpty(list: QuestionRecord[]): Promise<number> {
    if (list.length === 0) return 0;
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ukbi-seed-questions'))`);
      const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(questions);
      if (Number(c?.n ?? 0) > 0) return 0;
      await tx.insert(questions).values(list.map(questionValues));
      return list.length;
    });
  }

  async function insertMissingQuestions(list: QuestionRecord[]): Promise<number> {
    if (list.length === 0) return 0;
    const inserted = await db
      .insert(questions)
      .values(list.map(questionValues))
      .onConflictDoNothing({ target: questions.id })
      .returning({ id: questions.id });
    return inserted.length;
  }

  return {
    users: userRepo,
    tokens: tokenRepo,
    questions: questionRepo,
    sessions: sessionRepo,
    exposures: exposureRepo,
    seedQuestionsIfEmpty,
    insertMissingQuestions,
  };
}
