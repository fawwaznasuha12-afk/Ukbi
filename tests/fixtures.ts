import type { CandidateQuestion } from "../src/domain/selection/types";

export function makeBank(n: number, categories = ["listening", "reading", "writing"]): CandidateQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    categoryCode: categories[i % categories.length]!,
    difficulty: "MEDIUM" as const,
  }));
}
