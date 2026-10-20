import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { SCHEMA_SQL } from "./schema";
import type { Difficulty } from "../domain/selection/types";
import type { Rubric } from "../domain/scoring/rubric";
import { isLevel, type Level, type SessionLevel } from "../domain/levels";
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
} from "../repositories/types";

// node:sqlite dimuat lewat require supaya bundler dan Vite tidak salah me-resolve builtin ini.
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as { DatabaseSync: new (file: string) => DatabaseSyncT };

type Row = Record<string, unknown>;

/** Urutan kolom sama dengan INSERT/UPDATE pada tabel questions (tanpa id). */
type QuestionParams = [
  version: number, categoryCode: string, type: string, difficulty: string, level: string, stem: string,
  optionsJson: string, answerKey: string | null, explanation: string, rubricJson: string | null,
  transcript: string | null, source: string, status: string, updatedAt: number,
];

const ms = (d: Date | null | undefined): number | null => (d ? d.getTime() : null);
const date = (v: unknown): Date | null => (v === null || v === undefined ? null : new Date(Number(v)));
const json = <T>(v: unknown): T | null => (v === null || v === undefined ? null : (JSON.parse(String(v)) as T));

export interface AppDb {
  users: UserRepository;
  tokens: AuthTokenRepository;
  questions: QuestionRepository & QuestionAdminRepository;
  sessions: SessionRepository;
  exposures: ExposureRepository;
  /** Mengisi bank soal awal hanya jika tabel questions masih kosong. */
  seedQuestionsIfEmpty(questions: QuestionRecord[]): number;
  /** Menambahkan soal yang belum ada (id sama dilewati). Mengembalikan jumlah yang benar-benar masuk. */
  insertMissingQuestions(questions: QuestionRecord[]): number;
  close(): void;
}

function ensureColumn(db: DatabaseSyncT, table: string, column: string, ddl: string) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map((r) => String(r.name));
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function openAppDb(file: string): AppDb {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db: DatabaseSyncT = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA_SQL);
  // Migrasi ringan: database lama belum punya kolom level. Data lama tidak dihapus.
  ensureColumn(db, "questions", "level", "TEXT NOT NULL DEFAULT 'SMA_SMK'");
  ensureColumn(db, "sessions", "level", "TEXT NOT NULL DEFAULT 'SEMUA'");
  ensureColumn(db, "questions", "transcript", "TEXT");
  ensureColumn(db, "session_items", "transcript", "TEXT");

  const stmt = (sql: string) => db.prepare(sql);

  // ---------- users & tokens ----------
  const userFindByEmail = stmt("SELECT * FROM users WHERE email = ?");
  const userFindById = stmt("SELECT * FROM users WHERE id = ?");
  const userInsert = stmt("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)");
  const mapUser = (r: Row): UserRecord => ({
    id: String(r.id),
    email: String(r.email),
    passwordHash: String(r.password_hash),
    createdAt: date(r.created_at)!,
  });

  const tokenInsert = stmt("INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)");
  const tokenFind = stmt("SELECT * FROM auth_tokens WHERE token_hash = ?");
  const tokenDelete = stmt("DELETE FROM auth_tokens WHERE token_hash = ?");

  // ---------- questions ----------
  const qSelectActive = stmt("SELECT * FROM questions WHERE status = 'ACTIVE'");
  const qSelectAll = stmt("SELECT * FROM questions ORDER BY id");
  const qCount = stmt("SELECT COUNT(*) AS n FROM questions");
  const qInsertIgnore = stmt(`INSERT OR IGNORE INTO questions
    (id, version, category_code, type, difficulty, level, stem, options_json, answer_key, explanation, rubric_json, transcript, source, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const qInsert = stmt(`INSERT INTO questions
    (id, version, category_code, type, difficulty, level, stem, options_json, answer_key, explanation, rubric_json, transcript, source, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const qUpdate = stmt(`UPDATE questions SET
    version = ?, category_code = ?, type = ?, difficulty = ?, level = ?, stem = ?, options_json = ?, answer_key = ?,
    explanation = ?, rubric_json = ?, transcript = ?, source = ?, status = ?, updated_at = ?
    WHERE id = ?`);
  const mapQuestion = (r: Row): QuestionRecord => ({
    id: String(r.id),
    version: Number(r.version),
    categoryCode: String(r.category_code),
    type: String(r.type),
    difficulty: String(r.difficulty) as Difficulty,
    level: (isLevel(r.level) ? r.level : "SMA_SMK") as Level,
    stem: String(r.stem),
    options: json<QuestionRecord["options"]>(r.options_json) ?? [],
    answerKey: r.answer_key === null ? null : String(r.answer_key),
    explanation: String(r.explanation),
    rubric: json<Rubric>(r.rubric_json),
    transcript: r.transcript === null || r.transcript === undefined ? null : String(r.transcript),
    source: String(r.source),
    status: String(r.status) as "ACTIVE" | "ARCHIVED",
    updatedAt: date(r.updated_at)!,
  });
  const qParams = (q: QuestionRecord): QuestionParams => [
    q.version, q.categoryCode, q.type, q.difficulty, q.level, q.stem, JSON.stringify(q.options), q.answerKey,
    q.explanation, q.rubric ? JSON.stringify(q.rubric) : null, q.transcript, q.source, q.status, ms(q.updatedAt)!,
  ];

  // ---------- sessions ----------
  const sSelectOne = stmt("SELECT * FROM sessions WHERE id = ? AND user_id = ?");
  const sSelectByUser = stmt("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC, id DESC");
  const sMaxNumber = stmt("SELECT COALESCE(MAX(session_number), 0) AS n FROM sessions WHERE user_id = ?");
  const sInsert = stmt(`INSERT INTO sessions
    (id, user_id, session_number, title, mode, category_code, difficulty, level, question_count, seed, status,
     last_index, duration_sec, time_limit_sec, active_since, created_at, completed_at, result_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const sUpdate = stmt(`UPDATE sessions SET status = ?, last_index = ?, duration_sec = ?, active_since = ?,
    completed_at = ?, result_json = ? WHERE id = ? AND user_id = ?`);
  const iSelect = stmt("SELECT * FROM session_items WHERE session_id = ? ORDER BY position");
  const iInsert = stmt(`INSERT INTO session_items
    (session_id, position, question_id, question_version, type, category_code, difficulty, stem, options_json,
     answer_key, explanation, rubric_json, transcript, response, flagged)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const iUpdateState = stmt("UPDATE session_items SET response = ?, flagged = ? WHERE session_id = ? AND position = ?");

  const mapItem = (r: Row): SnapshotItem => ({
    position: Number(r.position),
    questionId: String(r.question_id),
    questionVersion: Number(r.question_version),
    type: String(r.type),
    categoryCode: String(r.category_code),
    difficulty: String(r.difficulty) as Difficulty,
    stem: String(r.stem),
    options: json<SnapshotItem["options"]>(r.options_json) ?? [],
    answerKey: r.answer_key === null ? null : String(r.answer_key),
    explanation: String(r.explanation),
    rubric: json<Rubric>(r.rubric_json),
    transcript: r.transcript === null || r.transcript === undefined ? null : String(r.transcript),
    response: r.response === null ? null : String(r.response),
    flagged: Number(r.flagged) === 1,
  });

  const loadItems = (sessionId: string): SnapshotItem[] => iSelect.all(sessionId).map((r) => mapItem(r as Row));

  const mapSession = (r: Row): SessionRecord => {
    const id = String(r.id);
    return {
      id,
      userId: String(r.user_id),
      sessionNumber: Number(r.session_number),
      title: String(r.title),
      mode: String(r.mode),
      categoryCode: r.category_code === null ? null : String(r.category_code),
      difficulty: r.difficulty === null ? null : (String(r.difficulty) as Difficulty),
      level: (String(r.level) === "SEMUA" ? "SEMUA" : isLevel(r.level) ? r.level : "SEMUA") as SessionLevel,
      questionCount: Number(r.question_count),
      seed: String(r.seed),
      status: String(r.status) as SessionRecord["status"],
      lastIndex: Number(r.last_index),
      durationSec: Number(r.duration_sec),
      timeLimitSec: r.time_limit_sec === null ? null : Number(r.time_limit_sec),
      activeSince: date(r.active_since),
      createdAt: date(r.created_at)!,
      completedAt: date(r.completed_at),
      result: json<unknown>(r.result_json),
      items: loadItems(id),
    };
  };

  /** Jalankan fungsi dalam transaksi. BEGIN IMMEDIATE mengunci penulisan sejak awal. */
  function tx<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }

  // ---------- exposures ----------
  const eSelect = stmt("SELECT * FROM exposures WHERE user_id = ?");
  const eUpsertSeen = stmt(`INSERT INTO exposures (user_id, question_id, times_seen, last_seen_at, last_correct)
    VALUES (?, ?, 1, ?, NULL)
    ON CONFLICT(user_id, question_id) DO UPDATE SET times_seen = times_seen + 1, last_seen_at = excluded.last_seen_at`);
  const eSetOutcome = stmt("UPDATE exposures SET last_correct = ? WHERE user_id = ? AND question_id = ?");

  const users: UserRepository = {
    async findByEmail(email) {
      const r = userFindByEmail.get(email) as Row | undefined;
      return r ? mapUser(r) : null;
    },
    async findById(id) {
      const r = userFindById.get(id) as Row | undefined;
      return r ? mapUser(r) : null;
    },
    async create(u) {
      userInsert.run(u.id, u.email, u.passwordHash, ms(u.createdAt)!);
    },
  };

  const tokens: AuthTokenRepository = {
    async add(rec: AuthTokenRecord) {
      tokenInsert.run(rec.tokenHash, rec.userId, ms(rec.expiresAt)!);
    },
    async find(tokenHash) {
      const r = tokenFind.get(tokenHash) as Row | undefined;
      return r ? { tokenHash: String(r.token_hash), userId: String(r.user_id), expiresAt: date(r.expires_at)! } : null;
    },
    async remove(tokenHash) {
      tokenDelete.run(tokenHash);
    },
  };

  const questions: QuestionRepository & QuestionAdminRepository = {
    async listActive(filter) {
      const rows = qSelectActive.all().map((r) => mapQuestion(r as Row));
      return rows.filter(
        (q) =>
          (!filter.categoryCode || q.categoryCode === filter.categoryCode) &&
          (!filter.difficulty || q.difficulty === filter.difficulty) &&
          (!filter.level || q.level === filter.level),
      );
    },
    async listAll() {
      return qSelectAll.all().map((r) => mapQuestion(r as Row));
    },
    async create(q) {
      qInsert.run(q.id, ...qParams(q));
    },
    async replace(q) {
      const res = qUpdate.run(...qParams(q), q.id);
      if (Number(res.changes) === 0) throw new Error(`Soal ${q.id} tidak ditemukan`);
    },
  };

  const sessions: SessionRepository = {
    async createWithSnapshot(input) {
      return tx(() => {
        const next = Number((sMaxNumber.get(input.userId) as Row).n) + 1;
        sInsert.run(
          input.id, input.userId, next, input.title, input.mode, input.categoryCode, input.difficulty, input.level,
          input.questionCount, input.seed, input.status, input.lastIndex, input.durationSec,
          input.timeLimitSec, ms(input.activeSince), ms(input.createdAt)!, ms(input.completedAt),
          null,
        );
        input.items.forEach((it) =>
          iInsert.run(
            input.id, it.position, it.questionId, it.questionVersion, it.type, it.categoryCode, it.difficulty,
            it.stem, JSON.stringify(it.options), it.answerKey, it.explanation,
            it.rubric ? JSON.stringify(it.rubric) : null, it.transcript, it.response, it.flagged ? 1 : 0,
          ),
        );
        return mapSession(sSelectOne.get(input.id, input.userId) as Row);
      });
    },
    async findForUser(userId, sessionId) {
      const r = sSelectOne.get(sessionId, userId) as Row | undefined;
      return r ? mapSession(r) : null;
    },
    async listForUser(userId) {
      return (sSelectByUser.all(userId) as Row[]).map(mapSession);
    },
    async save(rec) {
      tx(() => {
        const res = sUpdate.run(
          rec.status, rec.lastIndex, rec.durationSec, ms(rec.activeSince), ms(rec.completedAt),
          rec.result === null || rec.result === undefined ? null : JSON.stringify(rec.result),
          rec.id, rec.userId,
        );
        if (Number(res.changes) === 0) throw new Error("Sesi tidak ditemukan");
        for (const it of rec.items) iUpdateState.run(it.response, it.flagged ? 1 : 0, rec.id, it.position);
      });
    },
  };

  const exposures: ExposureRepository = {
    async getForUser(userId) {
      const m = new Map<string, ExposureRecord>();
      for (const r of eSelect.all(userId) as Row[]) {
        m.set(String(r.question_id), {
          timesSeen: Number(r.times_seen),
          lastSeenAt: date(r.last_seen_at),
          lastCorrect: r.last_correct === null ? null : Number(r.last_correct) === 1,
        });
      }
      return m;
    },
    async recordSeen(userId, seen) {
      tx(() => {
        for (const s of seen) eUpsertSeen.run(userId, s.questionId, ms(s.seenAt)!);
      });
    },
    async recordOutcome(userId, questionId, correct) {
      eSetOutcome.run(correct === null ? null : correct ? 1 : 0, userId, questionId);
    },
  };

  return {
    users,
    tokens,
    questions,
    sessions,
    exposures,
    seedQuestionsIfEmpty(seedList) {
      const n = Number((qCount.get() as Row).n);
      if (n > 0) return 0;
      tx(() => {
        for (const q of seedList) qInsert.run(q.id, ...qParams(q));
      });
      return seedList.length;
    },
    insertMissingQuestions(list) {
      let inserted = 0;
      tx(() => {
        for (const q of list) inserted += Number(qInsertIgnore.run(q.id, ...qParams(q)).changes);
      });
      return inserted;
    },
    close() {
      db.close();
    },
  };
}
