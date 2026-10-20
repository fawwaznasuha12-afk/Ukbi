import path from "node:path";
import { createPracticeService } from "../services/practice";
import { createAuthService } from "../services/auth";
import { createQuestionAdminService } from "../services/question-admin";
import { openAppDb } from "../db/sqlite";
import { createPostgresRepositories, type PostgresRepositories } from "../repositories/postgres";
import { getDb } from "../../db/index";
import { sampleQuestions } from "../../prisma/seed/sample-questions";
import { buildBank } from "../domain/questions/bank";
import { BANK_DIR, loadBankFiles } from "./bank-loader";

/**
 * Database:
 * - Di Netlify (NETLIFY_DB_URL tersedia): Postgres terkelola via Drizzle ORM.
 *   SQLite tidak bisa dipakai di runtime serverless karena filesystem hanya-baca.
 * - Lokal tanpa Netlify: SQLite lewat node:sqlite bawaan Node, di data/app.db
 *   (lokasi: APP_DB_FILE atau data/app.db).
 */

const DB_FILE = process.env.APP_DB_FILE ?? path.join(process.cwd(), "data", "app.db");

function adminEmailList(): string[] {
  const fallback = "admin@gmail.com";
  return (process.env.ADMIN_EMAILS ?? fallback)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Repository inti yang dipakai service, sama untuk backend SQLite maupun Postgres. */
type CoreRepos = Pick<
  PostgresRepositories,
  "users" | "tokens" | "questions" | "sessions" | "exposures"
>;

function buildServices(repos: CoreRepos) {
  return {
    practice: createPracticeService({ questions: repos.questions, exposures: repos.exposures, sessions: repos.sessions }),
    auth: createAuthService({ users: repos.users, tokens: repos.tokens }),
    questionAdmin: createQuestionAdminService({ questions: repos.questions }),
    adminEmails: adminEmailList(),
  };
}

type Container = ReturnType<typeof buildServices>;

/** Memuat bank soal dari content/bank ke database (soal yang gagal validasi dilewati dan dicatat). */
function bankRecords() {
  const sampleView = sampleQuestions.map((q) => ({
    id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status,
  }));
  const bank = buildBank(loadBankFiles(BANK_DIR), sampleView, new Date());
  for (const e of bank.errors) console.warn(`[bank] ${e.file} #${e.index}: ${e.message}`);
  return bank.records;
}

function buildSqlite(): Container {
  const db = openAppDb(DB_FILE);
  db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
  db.insertMissingQuestions(bankRecords());
  return buildServices(db);
}

/**
 * Bungkus tiap metode repository agar menunggu inisialisasi (seeding bank soal)
 * selesai. getContainer() tetap sinkron bagi pemanggilnya.
 */
function withReady<T extends object>(repos: T, ready: Promise<void>): T {
  return new Proxy(repos, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== "function") return orig;
      return async (...args: unknown[]) => {
        await ready;
        return (orig as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

const g = globalThis as unknown as { __ukbiContainer?: Container };

function createContainer(): Container {
  if (!process.env.NETLIFY_DB_URL) return buildSqlite();

  const repos = createPostgresRepositories(getDb());
  const ready = (async () => {
    await repos.seedQuestionsIfEmpty(structuredClone(sampleQuestions));
    await repos.insertMissingQuestions(bankRecords());
  })();
  const container = buildServices({
    users: withReady(repos.users, ready),
    tokens: withReady(repos.tokens, ready),
    questions: withReady(repos.questions, ready),
    sessions: withReady(repos.sessions, ready),
    exposures: withReady(repos.exposures, ready),
  });
  // Bila inisialisasi gagal (mis. koneksi), lepas cache agar permintaan berikutnya mencoba lagi.
  ready.catch((e) => {
    console.error("[db] inisialisasi gagal:", e);
    if (g.__ukbiContainer === container) g.__ukbiContainer = undefined;
  });
  return container;
}

/** Singleton per proses (aman untuk HMR dev). */
export function getContainer(): Container {
  return (g.__ukbiContainer ??= createContainer());
}
