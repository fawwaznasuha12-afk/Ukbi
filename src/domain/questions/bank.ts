import { validateDraft, type ExistingQuestion, type QuestionDraft } from "./validate";
import type { QuestionRecord } from "../../repositories/types";
import type { Rubric } from "../scoring/rubric";
import type { Level } from "../levels";

/** Format satu soal di berkas bank JSON (singkat supaya mudah ditulis dan ditinjau). */
export interface BankItem {
  c: string;
  t: string;
  d: string;
  l: string;
  /** Transkrip audio untuk soal listening. */
  a?: string;
  s: string;
  o?: string[];
  k?: string | null;
  e: string;
  r?: Rubric;
}

export interface BankFile {
  name: string;
  items: BankItem[];
}

export interface BankBuildResult {
  records: QuestionRecord[];
  errors: { file: string; index: number; message: string }[];
}

/**
 * Ubah berkas bank menjadi soal siap simpan. Setiap soal lewat validator yang sama dengan admin,
 * dan dicek duplikatnya terhadap soal yang sudah ada maupun soal lain dalam bank.
 */
export function buildBank(files: BankFile[], existing: ExistingQuestion[], now: Date): BankBuildResult {
  const records: QuestionRecord[] = [];
  const errors: BankBuildResult["errors"] = [];
  const seen: ExistingQuestion[] = [...existing];

  for (const file of files) {
    const stem = file.name.replace(/\.json$/, "");
    file.items.forEach((item, index) => {
      const id = `${stem}-${String(index + 1).padStart(3, "0")}`;
      const draft: QuestionDraft = {
        categoryCode: item.c,
        type: item.t,
        difficulty: item.d,
        level: item.l,
        stem: item.s,
        transcript: item.a ?? null,
        options: (item.o ?? []).map((text) => ({ text })),
        answerKey: item.k ?? null,
        explanation: item.e,
        rubric: item.r ?? null,
        source: "bank-v1",
      };
      const v = validateDraft(draft, seen);
      if (!v.ok) {
        errors.push({ file: file.name, index: index + 1, message: v.errors.join(" ") });
        return;
      }
      records.push({
        id,
        version: 1,
        categoryCode: v.value.categoryCode,
        type: v.value.type,
        difficulty: v.value.difficulty as QuestionRecord["difficulty"],
        level: v.value.level as Level,
        stem: v.value.stem,
        transcript: v.value.transcript,
        options: v.value.options.map((o) => ({ ...o, isCorrect: o.label === v.value.answerKey })),
        answerKey: v.value.answerKey,
        explanation: v.value.explanation,
        status: "ACTIVE",
        rubric: v.value.rubric,
        source: v.value.source,
        updatedAt: now,
      });
      seen.push({ id, stem: v.value.stem, transcript: v.value.transcript, optionTexts: v.value.options.map((o) => o.text), status: "ACTIVE" });
    });
  }
  return { records, errors };
}
