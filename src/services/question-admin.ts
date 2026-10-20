import { randomUUID } from "node:crypto";
import { validateDraft, type QuestionDraft } from "../domain/questions/validate";
import type { QuestionAdminRepository, QuestionRecord } from "../repositories/types";
import type { Level } from "../domain/levels";

export class QuestionValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
    this.name = "QuestionValidationError";
  }
}

export class QuestionNotFoundError extends Error {
  constructor() {
    super("Soal tidak ditemukan.");
    this.name = "QuestionNotFoundError";
  }
}

export function createQuestionAdminService(deps: {
  questions: QuestionAdminRepository;
  now?: () => Date;
  newId?: () => string;
}) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => `q-${randomUUID().slice(0, 8)}`);

  async function existingView(selfId?: string) {
    const all = await deps.questions.listAll();
    return all
      .filter((q) => q.id !== selfId)
      .map((q) => ({ id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status }));
  }

  return {
    list: () => deps.questions.listAll(),

    async create(draft: QuestionDraft): Promise<QuestionRecord> {
      const v = validateDraft(draft, await existingView());
      if (!v.ok) throw new QuestionValidationError(v.errors);
      const rec: QuestionRecord = {
        id: newId(),
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
        updatedAt: now(),
      };
      await deps.questions.create(rec);
      return rec;
    },

    /** Edit membuat versi baru. Sesi lama tetap memakai snapshot versi lamanya. */
    async update(id: string, draft: QuestionDraft): Promise<QuestionRecord> {
      const current = (await deps.questions.listAll()).find((q) => q.id === id);
      if (!current) throw new QuestionNotFoundError();
      const v = validateDraft(draft, await existingView(id), id);
      if (!v.ok) throw new QuestionValidationError(v.errors);
      const rec: QuestionRecord = {
        ...current,
        version: current.version + 1,
        categoryCode: v.value.categoryCode,
        type: v.value.type,
        difficulty: v.value.difficulty as QuestionRecord["difficulty"],
        level: v.value.level as Level,
        stem: v.value.stem,
        options: v.value.options.map((o) => ({ ...o, isCorrect: o.label === v.value.answerKey })),
        answerKey: v.value.answerKey,
        explanation: v.value.explanation,
        rubric: v.value.rubric,
        source: v.value.source,
        updatedAt: now(),
      };
      await deps.questions.replace(rec);
      return rec;
    },

    async setArchived(id: string, archived: boolean): Promise<void> {
      const current = (await deps.questions.listAll()).find((q) => q.id === id);
      if (!current) throw new QuestionNotFoundError();
      await deps.questions.replace({ ...current, status: archived ? "ARCHIVED" : "ACTIVE", updatedAt: now() });
    },
  };
}
