import { createRng, seededShuffle } from "./rng";
import {
  type CandidateQuestion,
  InsufficientQuestionsError,
  type SelectionOptions,
} from "./types";

/**
 * Prioritas (kecil = lebih diutamakan):
 *  0 : belum pernah muncul
 *  1 : pernah muncul, diurutkan dari yang paling lama tidak muncul
 * Mode "weak" menaikkan soal yang terakhir salah ke depan dalam tiap tier.
 */
function priorityKey(q: CandidateQuestion, focusWeak: boolean): [number, number, number] {
  const ex = q.exposure;
  if (!ex || ex.timesSeen === 0) {
    return [0, 0, 0];
  }
  const weakRank = focusWeak && ex.lastCorrect === false ? 0 : 1;
  const lastSeen = ex.lastSeenAt ? ex.lastSeenAt.getTime() : 0;
  return [1, weakRank, lastSeen];
}

function compareKeys(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Memilih `count` soal unik dengan:
 * - prioritas soal yang belum/lama tidak muncul,
 * - distribusi kategori seimbang (round-robin),
 * - hasil deterministik untuk seed yang sama (tie-break memakai PRNG seeded).
 * Melempar InsufficientQuestionsError jika pool kurang dari `count`.
 */
export function selectQuestions(
  pool: readonly CandidateQuestion[],
  options: SelectionOptions,
): string[] {
  const { count, seed, focus = "variety" } = options;
  const unique = new Map<string, CandidateQuestion>();
  for (const q of pool) {
    if (!unique.has(q.id)) unique.set(q.id, q);
  }
  if (unique.size < count) {
    throw new InsufficientQuestionsError(count, unique.size);
  }

  const rng = createRng(seed);
  const focusWeak = focus === "weak";

  // Acak dulu (seeded) agar tie-break stabil, lalu sort stabil berdasarkan prioritas.
  const shuffled = seededShuffle([...unique.values()], rng);
  const sorted = shuffled.sort((a, b) =>
    compareKeys(priorityKey(a, focusWeak), priorityKey(b, focusWeak)),
  );

  // Kelompokkan per kategori, pertahankan urutan prioritas di dalamnya.
  const byCategory = new Map<string, CandidateQuestion[]>();
  for (const q of sorted) {
    const bucket = byCategory.get(q.categoryCode) ?? [];
    bucket.push(q);
    byCategory.set(q.categoryCode, bucket);
  }
  const categoryOrder = seededShuffle([...byCategory.keys()], rng);

  const selected: string[] = [];
  while (selected.length < count) {
    for (const cat of categoryOrder) {
      const bucket = byCategory.get(cat);
      if (!bucket || bucket.length === 0) continue;
      selected.push(bucket.shift()!.id);
      if (selected.length === count) break;
    }
  }
  return selected;
}
