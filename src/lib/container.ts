import path from "node:path";
import { createPracticeService } from "../services/practice";
import { createAuthService } from "../services/auth";
import { createQuestionAdminService } from "../services/question-admin";
import { openAppDb } from "../db/sqlite";
import { sampleQuestions } from "../../prisma/seed/sample-questions";
import { buildBank } from "../domain/questions/bank";
import { BANK_DIR, loadBankFiles } from "./bank-loader";

/**
 * Database: SQLite lewat node:sqlite bawaan Node (tanpa server, tanpa paket native).
 * Lokasi file: APP_DB_FILE atau data/app.db.
 */
const DB_FILE = process.env.APP_DB_FILE ?? path.join(process.cwd(), "data", "app.db");

function build() {
  const db = openAppDb(DB_FILE);
  db.seedQuestionsIfEmpty(structuredClone(sampleQuestions));

  // Bank dari content/bank: soal yang gagal validasi dilewati dan dicatat, tidak menggagalkan server.
  const sampleView = sampleQuestions.map((q) => ({
    id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status,
  }));
  const bank = buildBank(loadBankFiles(BANK_DIR), sampleView, new Date());
  for (const e of bank.errors) console.warn(`[bank] ${e.file} #${e.index}: ${e.message}`);
  db.insertMissingQuestions(bank.records);

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    practice: createPracticeService({ questions: db.questions, exposures: db.exposures, sessions: db.sessions }),
    auth: createAuthService({ users: db.users, tokens: db.tokens }),
    questionAdmin: createQuestionAdminService({ questions: db.questions }),
    adminEmails,
  };
}

type Container = ReturnType<typeof build>;
const g = globalThis as unknown as { __ukbiContainer?: Container };

/** Singleton per proses (aman untuk HMR dev). */
export function getContainer(): Container {
  return (g.__ukbiContainer ??= build());
}
