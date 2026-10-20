import type { Rubric } from "../scoring/rubric";
import { isLevel } from "../levels";

export const CATEGORY_CODES = ["listening", "language_rules", "reading", "writing", "speaking"] as const;
export const OBJECTIVE_TYPES = ["MULTIPLE_CHOICE", "READING_MC"] as const;
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export interface QuestionDraft {
  categoryCode: string;
  type: string;
  difficulty: string;
  level: string;
  stem: string;
  /** Transkrip untuk soal listening (yang diperdengarkan). Null untuk kategori lain. */
  transcript: string | null;
  options: { text: string }[];
  answerKey: string | null;
  explanation: string;
  rubric: Rubric | null;
  source: string;
}

export interface ExistingQuestion {
  id: string;
  stem: string;
  /** Untuk soal listening, transkrip ikut menentukan identitas soal. */
  transcript?: string | null;
  optionTexts: string[];
  status: "ACTIVE" | "ARCHIVED";
}

export type ValidatedDraft = Omit<QuestionDraft, "options"> & { options: { label: string; text: string }[] };

export type ValidationResult =
  | { ok: true; value: ValidatedDraft }
  | { ok: false; errors: string[] };

/**
 * Pilihan jawaban dibandingkan secara exact (spasi dirapikan saja). Tanda baca, huruf besar,
 * dan tanda hubung bisa jadi inti soal ejaan, jadi tidak boleh dibuang.
 */
export function optionKey(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function identityOf(stem: string, transcript: string | null): string {
  return transcript ? `${transcript} ${stem}` : stem;
}

/** Normalisasi longgar untuk deteksi duplikat teks soal: huruf kecil, tanpa tanda baca, spasi tunggal. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateDraft(
  draft: QuestionDraft,
  existing: ExistingQuestion[],
  selfId?: string,
): ValidationResult {
  const errors: string[] = [];
  const stem = draft.stem.trim();
  const explanation = draft.explanation.trim();

  if (!(CATEGORY_CODES as readonly string[]).includes(draft.categoryCode)) errors.push("Kategori tidak dikenal.");
  if (!(DIFFICULTIES as readonly string[]).includes(draft.difficulty)) errors.push("Tingkat kesulitan tidak valid.");
  if (!isLevel(draft.level)) errors.push("Jenjang tidak valid (SD, SMP, SMA_SMK, KULIAH, LANJUTAN).");
  if (stem.length < 10 || stem.length > 1000) errors.push("Teks soal harus 10–1000 karakter.");
  const transcript = draft.transcript?.trim() || null;
  if (draft.categoryCode === "listening") {
    if (!transcript) errors.push("Soal listening wajib punya transkrip audio.");
    else if (transcript.length > 800) errors.push("Transkrip maks 800 karakter.");
  }
  if (explanation.length < 1 || explanation.length > 2000) errors.push("Pembahasan wajib diisi (maks 2000 karakter).");
  if (!draft.source.trim()) errors.push("Sumber soal wajib diisi (misalnya: sampel-orisinal).");

  let options: { label: string; text: string }[] = [];
  let answerKey: string | null = null;

  if (draft.type === "ESSAY") {
    if (draft.options.length > 0) errors.push("Soal esai tidak boleh punya pilihan jawaban.");
    if (draft.answerKey !== null) errors.push("Soal esai tidak punya kunci jawaban otomatis.");
    const r = draft.rubric;
    if (!r) {
      errors.push("Soal esai wajib punya rubrik.");
    } else {
      if (r.minWords < 1) errors.push("Minimal kata harus ≥ 1.");
      if (r.maxWords < r.minWords) errors.push("Maksimal kata tidak boleh kurang dari minimal.");
      if (r.minSentences < 1) errors.push("Minimal kalimat harus ≥ 1.");
      if (r.requiredKeywords.length > 10) errors.push("Maksimal 10 kata kunci.");
    }
  } else if ((OBJECTIVE_TYPES as readonly string[]).includes(draft.type)) {
    if (draft.options.length < 2 || draft.options.length > 6) {
      errors.push("Soal pilihan ganda butuh 2–6 pilihan.");
    }
    const texts = draft.options.map((o) => o.text.trim());
    if (texts.some((t) => t.length === 0 || t.length > 300)) errors.push("Setiap pilihan harus 1–300 karakter.");
    if (new Set(texts.map(optionKey)).size !== texts.length) errors.push("Ada pilihan jawaban yang sama.");

    options = texts.map((text, i) => ({ label: String.fromCharCode(65 + i), text }));
    if (draft.answerKey === null || !options.some((o) => o.label === draft.answerKey)) {
      errors.push("Kunci jawaban harus salah satu label pilihan.");
    } else {
      answerKey = draft.answerKey;
    }
  } else {
    errors.push("Jenis soal tidak didukung.");
  }

  // Duplikat: teks soal sama, atau pilihan sama walau urutannya beda.
  // Soal listening punya identitas = transkrip + pertanyaan.
  const stemKey = normalizeText(identityOf(stem, transcript));
  const setKey = `${stemKey}||${options.map((o) => optionKey(o.text)).sort().join("|")}`;
  for (const q of existing) {
    if (q.status !== "ACTIVE" || q.id === selfId) continue;
    const otherKey = normalizeText(identityOf(q.stem, q.transcript ?? null));
    const otherSetKey = `${otherKey}||${q.optionTexts.map(optionKey).sort().join("|")}`;
    if (otherKey === stemKey || otherSetKey === setKey) {
      errors.push(`Duplikat dengan soal ${q.id}.`);
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...draft, stem, explanation, options, answerKey, source: draft.source.trim(), transcript: draft.categoryCode === "listening" ? transcript : null },
  };
}
