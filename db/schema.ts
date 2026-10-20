/**
 * Skema Postgres (Netlify Database) untuk Drizzle ORM.
 * Mereplikasi skema SQLite di src/db/schema.ts, dengan konvensi Postgres:
 * waktu memakai timestamptz dan JSON memakai jsonb.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export interface StoredOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface StoredRubric {
  minWords: number;
  maxWords: number;
  minSentences: number;
  requiredKeywords: string[];
}

/** Snapshot sesi hanya menyimpan label dan teks pilihan, tanpa kunci jawaban. */
export interface StoredSnapshotOption {
  label: string;
  text: string;
}

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const authTokens = pgTable("auth_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    categoryCode: text("category_code").notNull(),
    type: text("type").notNull(),
    difficulty: text("difficulty").notNull(),
    stem: text("stem").notNull(),
    options: jsonb("options").$type<StoredOption[]>().notNull(),
    answerKey: text("answer_key"),
    explanation: text("explanation").notNull(),
    rubric: jsonb("rubric").$type<StoredRubric | null>(),
    source: text("source").notNull(),
    level: text("level").notNull().default("SMA_SMK"),
    transcript: text("transcript"),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("idx_questions_status").on(t.status, t.categoryCode, t.difficulty)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionNumber: integer("session_number").notNull(),
    title: text("title").notNull(),
    mode: text("mode").notNull(),
    categoryCode: text("category_code"),
    difficulty: text("difficulty"),
    level: text("level").notNull().default("SEMUA"),
    questionCount: integer("question_count").notNull(),
    seed: text("seed").notNull(),
    status: text("status").notNull(),
    lastIndex: integer("last_index").notNull().default(0),
    durationSec: integer("duration_sec").notNull().default(0),
    timeLimitSec: integer("time_limit_sec"),
    activeSince: timestamp("active_since", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    result: jsonb("result"),
  },
  (t) => [
    uniqueIndex("uq_sessions_user_number").on(t.userId, t.sessionNumber),
    index("idx_sessions_user").on(t.userId, t.createdAt),
  ],
);

/** Snapshot soal per sesi: tidak ikut berubah saat bank soal diedit. */
export const sessionItems = pgTable(
  "session_items",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionId: text("question_id").notNull(),
    questionVersion: integer("question_version").notNull(),
    type: text("type").notNull(),
    categoryCode: text("category_code").notNull(),
    difficulty: text("difficulty").notNull(),
    stem: text("stem").notNull(),
    options: jsonb("options").$type<StoredSnapshotOption[]>().notNull(),
    answerKey: text("answer_key"),
    explanation: text("explanation").notNull(),
    rubric: jsonb("rubric").$type<StoredRubric | null>(),
    transcript: text("transcript"),
    response: text("response"),
    flagged: boolean("flagged").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.position] }),
    uniqueIndex("uq_session_items_question").on(t.sessionId, t.questionId),
  ],
);

export const exposures = pgTable(
  "exposures",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    timesSeen: integer("times_seen").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastCorrect: boolean("last_correct"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] })],
);
