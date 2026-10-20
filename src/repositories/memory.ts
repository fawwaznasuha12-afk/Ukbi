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
  UserRecord,
  UserRepository,
} from "./types";
import type { Difficulty } from "../domain/selection/types";
import type { Level } from "../domain/levels";

export class MemoryQuestionRepository implements QuestionRepository, QuestionAdminRepository {
  constructor(private questions: QuestionRecord[], private readonly onChange: () => void = () => {}) {}

  async listActive(filter: { categoryCode?: string; difficulty?: Difficulty; level?: Level }) {
    return this.questions
      .filter((q) => q.status === "ACTIVE")
      .filter((q) => !filter.categoryCode || q.categoryCode === filter.categoryCode)
      .filter((q) => !filter.difficulty || q.difficulty === filter.difficulty)
      .filter((q) => !filter.level || q.level === filter.level)
      .map((q) => structuredClone(q));
  }

  async listAll() {
    return this.questions.map((q) => structuredClone(q));
  }

  async create(q: QuestionRecord) {
    if (this.questions.some((x) => x.id === q.id)) throw new Error(`ID soal ${q.id} sudah ada`);
    this.questions.push(structuredClone(q));
    this.onChange();
  }

  /** Mengganti isi soal. Sesi lama tidak terpengaruh karena sudah punya snapshot. */
  async replace(q: QuestionRecord) {
    const idx = this.questions.findIndex((x) => x.id === q.id);
    if (idx === -1) throw new Error(`Soal ${q.id} tidak ditemukan`);
    this.questions[idx] = structuredClone(q);
    this.onChange();
  }

  /** Ubah sebagian field soal (dipakai tes untuk simulasi edit bank). */
  update(id: string, patch: Partial<QuestionRecord>) {
    const cur = this.questions.find((x) => x.id === id);
    if (!cur) throw new Error(`Soal ${id} tidak ditemukan`);
    Object.assign(cur, patch);
    this.onChange();
  }

  all(): QuestionRecord[] {
    return structuredClone(this.questions);
  }
}

type ExposureMap = Record<string, Record<string, ExposureRecord>>;

export class MemoryExposureRepository implements ExposureRepository {
  private store: ExposureMap;

  constructor(initial: ExposureMap = {}, private readonly onChange: () => void = () => {}) {
    this.store = initial;
  }

  private bucket(userId: string) {
    return (this.store[userId] ??= {});
  }

  async getForUser(userId: string) {
    const b = this.bucket(userId);
    return new Map(Object.entries(b).map(([k, v]) => [k, { ...v }]));
  }

  async recordSeen(userId: string, seen: { questionId: string; seenAt: Date }[]) {
    const b = this.bucket(userId);
    for (const { questionId, seenAt } of seen) {
      const cur = b[questionId] ?? { timesSeen: 0, lastSeenAt: null, lastCorrect: null };
      b[questionId] = { ...cur, timesSeen: cur.timesSeen + 1, lastSeenAt: seenAt };
    }
    this.onChange();
  }

  async recordOutcome(userId: string, questionId: string, correct: boolean | null) {
    const b = this.bucket(userId);
    const cur = b[questionId];
    if (cur) b[questionId] = { ...cur, lastCorrect: correct };
    this.onChange();
  }

  all(): ExposureMap {
    return structuredClone(this.store);
  }
}

export class MemorySessionRepository implements SessionRepository {
  private rows: SessionRecord[];

  constructor(initial: SessionRecord[] = [], private readonly onChange: () => void = () => {}) {
    this.rows = initial;
  }

  async createWithSnapshot(input: Parameters<SessionRepository["createWithSnapshot"]>[0]) {
    const sessionNumber =
      this.rows.filter((r) => r.userId === input.userId).reduce((m, r) => Math.max(m, r.sessionNumber), 0) + 1;
    const record: SessionRecord = { ...input, sessionNumber, result: null, items: structuredClone(input.items) };
    this.rows.push(record);
    this.onChange();
    return structuredClone(record);
  }

  async findForUser(userId: string, sessionId: string) {
    const r = this.rows.find((x) => x.id === sessionId && x.userId === userId);
    return r ? structuredClone(r) : null;
  }

  async listForUser(userId: string) {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => structuredClone(r));
  }

  async save(record: SessionRecord) {
    const idx = this.rows.findIndex((r) => r.id === record.id && r.userId === record.userId);
    if (idx === -1) throw new Error("Sesi tidak ditemukan");
    this.rows[idx] = structuredClone(record);
    this.onChange();
  }

  all(): SessionRecord[] {
    return structuredClone(this.rows);
  }
}

export class MemoryUserRepository implements UserRepository {
  constructor(private users: UserRecord[] = [], private readonly onChange: () => void = () => {}) {}

  async findByEmail(email: string) {
    const u = this.users.find((x) => x.email === email);
    return u ? { ...u } : null;
  }

  async findById(id: string) {
    const u = this.users.find((x) => x.id === id);
    return u ? { ...u } : null;
  }

  async create(user: UserRecord) {
    this.users.push({ ...user });
    this.onChange();
  }

  all(): UserRecord[] {
    return structuredClone(this.users);
  }
}

export class MemoryAuthTokenRepository implements AuthTokenRepository {
  constructor(private tokens: AuthTokenRecord[] = [], private readonly onChange: () => void = () => {}) {}

  async add(rec: AuthTokenRecord) {
    this.tokens.push({ ...rec });
    this.onChange();
  }

  async find(tokenHash: string) {
    const t = this.tokens.find((x) => x.tokenHash === tokenHash);
    return t ? { ...t } : null;
  }

  async remove(tokenHash: string) {
    this.tokens = this.tokens.filter((x) => x.tokenHash !== tokenHash);
    this.onChange();
  }

  all(): AuthTokenRecord[] {
    return structuredClone(this.tokens);
  }
}
