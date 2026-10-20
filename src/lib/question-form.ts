import type { QuestionDraft } from "@/domain/questions/validate";

/**
 * Form admin: pilihan jawaban satu per baris. Untuk esai, kolom rubrik dipakai.
 * Kata kunci rubrik dipisah koma.
 */
export function parseQuestionForm(formData: FormData): QuestionDraft {
  const get = (k: string) => String(formData.get(k) ?? "");
  const type = get("type");
  const isEssay = type === "ESSAY";
  const optionLines = get("options").split("\n").map((t) => t.trim()).filter((t) => t.length > 0);
  const kw = get("requiredKeywords").split(",").map((k) => k.trim()).filter(Boolean);
  return {
    categoryCode: get("categoryCode"),
    type,
    difficulty: get("difficulty"),
    level: get("level"),
    stem: get("stem"),
    transcript: get("transcript") || null,
    options: isEssay ? [] : optionLines.map((text) => ({ text })),
    answerKey: isEssay ? null : get("answerKey").trim().toUpperCase() || null,
    explanation: get("explanation"),
    source: get("source") || "admin",
    rubric: isEssay
      ? {
          minWords: Number(get("minWords")),
          maxWords: Number(get("maxWords")),
          minSentences: Number(get("minSentences")),
          requiredKeywords: kw,
        }
      : null,
  };
}
