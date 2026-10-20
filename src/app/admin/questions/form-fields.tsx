import type { QuestionRecord } from "@/repositories/types";
import { categoryLabels } from "@/lib/labels";
import { LEVELS, LEVEL_LABELS } from "@/domain/levels";

export function QuestionFields({ initial }: { initial?: QuestionRecord }) {
  const isEssay = initial?.type === "ESSAY";
  const field = "w-full rounded-lg border border-rule bg-white p-2 text-sm";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Kategori</span>
        <select name="categoryCode" defaultValue={initial?.categoryCode ?? "reading"} className={field}>
          {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Jenis soal</span>
        <select name="type" defaultValue={initial?.type ?? "READING_MC"} className={field}>
          <option value="MULTIPLE_CHOICE">Pilihan ganda</option>
          <option value="READING_MC">Pilihan ganda berbasis bacaan</option>
          <option value="ESSAY">Esai (rubrik)</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Jenjang</span>
        <select name="level" defaultValue={initial?.level ?? "SMP"} className={field}>
          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Tingkat kesulitan</span>
        <select name="difficulty" defaultValue={initial?.difficulty ?? "MEDIUM"} className={field}>
          <option value="EASY">Mudah</option>
          <option value="MEDIUM">Sedang</option>
          <option value="HARD">Sulit</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Sumber</span>
        <input name="source" defaultValue={initial?.source ?? "sampel-orisinal"} className={field} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Teks soal (10–1000 karakter)</span>
        <textarea name="stem" required minLength={10} maxLength={1000} defaultValue={initial?.stem ?? ""} className={`${field} min-h-24`} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Transkrip audio (wajib untuk kategori Mendengarkan)</span>
        <textarea name="transcript" maxLength={800} defaultValue={initial?.transcript ?? ""} className={`${field} min-h-20`} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Pilihan jawaban, satu per baris (kosongkan untuk esai)</span>
        <textarea name="options" defaultValue={isEssay ? "" : (initial?.options.map((o) => o.text).join("\n") ?? "")} className={`${field} min-h-24`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Kunci jawaban (huruf, mis. B)</span>
        <input name="answerKey" maxLength={1} defaultValue={isEssay ? "" : (initial?.answerKey ?? "")} className={field} />
      </label>
      <fieldset className="rounded-lg border border-rule p-3 text-sm sm:col-span-2">
        <legend className="px-1 font-medium">Rubrik esai (hanya untuk jenis Esai)</legend>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>Min kata<input name="minWords" type="number" min={1} defaultValue={initial?.rubric?.minWords ?? 30} className={field} /></label>
          <label>Maks kata<input name="maxWords" type="number" min={1} defaultValue={initial?.rubric?.maxWords ?? 150} className={field} /></label>
          <label>Min kalimat<input name="minSentences" type="number" min={1} defaultValue={initial?.rubric?.minSentences ?? 3} className={field} /></label>
          <label>Kata kunci (koma)<input name="requiredKeywords" defaultValue={initial?.rubric?.requiredKeywords.join(", ") ?? ""} className={field} /></label>
        </div>
      </fieldset>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Pembahasan</span>
        <textarea name="explanation" required maxLength={2000} defaultValue={initial?.explanation ?? ""} className={`${field} min-h-20`} />
      </label>
    </div>
  );
}
