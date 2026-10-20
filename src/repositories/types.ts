import type { Difficulty } from "../domain/selection/types";
import type { SessionStatus } from "../domain/session/status";
import type { Rubric } from "../domain/scoring/rubric";
import type { Level, SessionLevel } from "../domain/levels";

export interface QuestionRecord {
  id: string;
  version: number;
  categoryCode: string;
  type: string;
  difficulty: Difficulty;
  level: Level;
  stem: string;
  transcript: string | null;
  options: { label: string; text: string; isCorrect: boolean }[];
  answerKey: string | null;
  explanation: string;
  status: "ACTIVE" | "ARCHIVED";
  rubric: Rubric | null;
  source: string;
  updatedAt: Date;
}

export interface ExposureRecord {
  timesSeen: number;
  lastSeenAt: Date | null;
  lastCorrect: boolean | null;
}

export interface SnapshotItem {
  position: number;
  questionId: string;
  questionVersion: number;
  type: string;
  categoryCode: string;
  difficulty: Difficulty;
  stem: string;
  options: { label: string; text: string }[];
  answerKey: string | null;
  explanation: string;
  rubric: Rubric | null;
  transcript: string | null;
  response: string | null;
  flagged: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  sessionNumber: number;
  title: string;
  mode: string;
  categoryCode: string | null;
  difficulty: Difficulty | null;
  level: SessionLevel;
  questionCount: number;
  seed: string;
  status: SessionStatus;
  lastIndex: number;
  durationSec: number;
  timeLimitSec: number | null;
  /** Waktu mulai/lanjut terakhir; null jika sedang tidak aktif. */
  activeSince: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  items: SnapshotItem[];
  result: unknown | null;
}

export interface QuestionRepository {
  listActive(filter: { categoryCode?: string; difficulty?: Difficulty; level?: Level }): Promise<QuestionRecord[]>;
}

export interface ExposureRepository {
  getForUser(userId: string): Promise<Map<string, ExposureRecord>>;
  recordSeen(
    userId: string,
    seen: { questionId: string; seenAt: Date }[],
  ): Promise<void>;
  recordOutcome(userId: string, questionId: string, correct: boolean | null): Promise<void>;
}

export interface SessionRepository {
  /** Membuat sesi + snapshot secara atomik. Nomor sesi dihitung di dalam transaksi. */
  createWithSnapshot(
    input: Omit<SessionRecord, "sessionNumber" | "items" | "result"> & {
      items: SnapshotItem[];
    },
  ): Promise<SessionRecord>;
  findForUser(userId: string, sessionId: string): Promise<SessionRecord | null>;
  listForUser(userId: string): Promise<SessionRecord[]>;
  save(record: SessionRecord): Promise<void>;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface AuthTokenRecord {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(user: UserRecord): Promise<void>;
}

export interface AuthTokenRepository {
  add(rec: AuthTokenRecord): Promise<void>;
  find(tokenHash: string): Promise<AuthTokenRecord | null>;
  remove(tokenHash: string): Promise<void>;
}

export interface QuestionAdminRepository {
  listAll(): Promise<QuestionRecord[]>;
  create(q: QuestionRecord): Promise<void>;
  replace(q: QuestionRecord): Promise<void>;
}
