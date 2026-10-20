import { z } from "zod";
import { LEVELS, ALL_LEVELS } from "../../domain/levels";

export const practiceModes = [
  "SIMULASI",
  "QUICK",
  "STANDARD",
  "INTENSIVE",
  "CATEGORY",
  "DIFFICULTY",
  "WEAK_QUESTIONS",
] as const;

/** Mode dengan jumlah soal tetap. Mode lain memakai questionCount dari input. */
export const fixedModeCount: Partial<Record<(typeof practiceModes)[number], number>> = {
  QUICK: 3,
  STANDARD: 8,
  INTENSIVE: 15,
};

export const createSessionInput = z
  .object({
    mode: z.enum(practiceModes),
    categoryCode: z.string().trim().min(1).max(64).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    level: z.enum([ALL_LEVELS, ...LEVELS]).default(ALL_LEVELS),
    questionCount: z.number().int().min(1).max(50),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "CATEGORY" && !v.categoryCode) {
      ctx.addIssue({ code: "custom", path: ["categoryCode"], message: "Kategori wajib untuk mode kategori." });
    }
    if (v.mode === "DIFFICULTY" && !v.difficulty) {
      ctx.addIssue({ code: "custom", path: ["difficulty"], message: "Tingkat kesulitan wajib untuk mode ini." });
    }
  });

export const answerInput = z.object({
  position: z.number().int().min(0),
  response: z.string().max(4000).nullable(),
  flagged: z.boolean().optional(),
});

/** Input dari pemanggil: level boleh tidak diisi (default SEMUA). */
export type CreateSessionInput = z.input<typeof createSessionInput>;
export type AnswerInput = z.infer<typeof answerInput>;
