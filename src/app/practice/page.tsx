import { createSessionAction } from "../actions";
import { categoryLabels } from "@/lib/labels";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { LEVELS, LEVEL_LABELS } from "@/domain/levels";

export const dynamic = "force-dynamic";

const modes = [
  { value: "SIMULASI", label: "Simulasi Paket 1 (105 soal, 100 menit)", defaultCount: 105 },
  { value: "QUICK", label: "Latihan Cepat (3 soal)", defaultCount: 3 },
  { value: "STANDARD", label: "Latihan Standar (8 soal)", defaultCount: 8 },
  { value: "INTENSIVE", label: "Latihan Intensif (15 soal)", defaultCount: 15 },
  { value: "CATEGORY", label: "Berdasarkan Kategori", defaultCount: 5 },
  { value: "DIFFICULTY", label: "Berdasarkan Tingkat Kesulitan", defaultCount: 5 },
  { value: "WEAK_QUESTIONS", label: "Soal yang Sering Salah", defaultCount: 5 },
];

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  const bank = await getContainer().practice.bankSummary();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Mulai Latihan</h1>
      <p className="text-sm text-muted">
        Setiap klik membuat sesi baru dengan ID sendiri. Sesi lama tetap bisa dibuka. Bank soal saat ini berisi {bank.total} soal sampel orisinal.
      </p>
      {error && <p role="alert" className="rounded-lg notice-error">{error}</p>}

      <form action={createSessionAction} className="space-y-5 panel p-5">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Mode</legend>
          {modes.map((m, i) => (
            <label key={m.value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="mode" value={m.value} defaultChecked={i === 1} className="accent-accent" />
              {m.label}
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="level" className="mb-1 block text-sm font-medium">Jenjang</label>
          <select id="level" name="level" defaultValue="SEMUA" className="w-full rounded-md border border-rule bg-surface p-2 text-sm">
            <option value="SEMUA">Semua jenjang</option>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">Soal dipilih dari jenjang ini saja. Jumlah soal per jenjang tampil di Bank soal.</p>
        </div>

        <div>
          <label htmlFor="categoryCode" className="mb-1 block text-sm font-medium">Kategori (wajib untuk mode kategori)</label>
          <select id="categoryCode" name="categoryCode" className="w-full rounded-lg border border-rule bg-white p-2 text-sm">
            <option value="">—</option>
            {Object.keys(bank.byCategory).map((c) => <option key={c} value={c}>{categoryLabels[c] ?? c}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="difficulty" className="mb-1 block text-sm font-medium">Tingkat kesulitan (wajib untuk mode kesulitan)</label>
          <select id="difficulty" name="difficulty" className="w-full rounded-lg border border-rule bg-white p-2 text-sm">
            <option value="">—</option>
            <option value="EASY">Mudah</option>
            <option value="MEDIUM">Sedang</option>
            <option value="HARD">Sulit</option>
          </select>
        </div>

        <div>
          <label htmlFor="questionCount" className="mb-1 block text-sm font-medium">Jumlah soal (1–50, hanya untuk mode kategori, kesulitan, dan soal sering salah)</label>
          <input id="questionCount" name="questionCount" type="number" min={1} max={50} defaultValue={8} className="w-full rounded-lg border border-rule p-2 text-sm" />
        </div>

        <button type="submit" className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-[#174a44]">
          Buat Sesi Baru
        </button>
      </form>
    </div>
  );
}
