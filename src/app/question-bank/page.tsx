import Link from "next/link";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { categoryLabels } from "@/lib/labels";
import { LEVELS, LEVEL_LABELS } from "@/domain/levels";

export const dynamic = "force-dynamic";

export default async function QuestionBankPage() {
  await requireUser();
  const bank = await getContainer().practice.bankSummary();
  const cats = Object.keys(bank.byCategory);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="serif text-3xl">Bank soal</h1>
        <p className="text-sm text-muted">
          {bank.total} soal aktif. Sebagian besar adalah soal orisinal untuk latihan, bukan soal resmi UKBI.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-rule">
              <th className="py-2 font-normal">Kategori</th>
              {LEVELS.map((l) => (
                <th key={l} className="py-2 text-right font-normal">{LEVEL_LABELS[l]}</th>
              ))}
              <th className="py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((code) => (
              <tr key={code} className="border-b border-rule">
                <td className="py-3">
                  <Link href={`/practice?mode=CATEGORY&category=${code}`} className="link">
                    {categoryLabels[code] ?? code}
                  </Link>
                </td>
                {LEVELS.map((l) => (
                  <td key={l} className="py-3 text-right tabular-nums">{countFor(bank, code, l)}</td>
                ))}
                <td className="py-3 text-right tabular-nums">{bank.byCategory[code]?.total ?? 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-3 text-muted">Semua kategori</td>
              {LEVELS.map((l) => (
                <td key={l} className="py-3 text-right tabular-nums text-muted">{bank.byLevel[l] ?? 0}</td>
              ))}
              <td className="py-3 text-right tabular-nums text-muted">{bank.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Jumlah soal per kategori dan jenjang, dihitung dari ringkasan per kategori. */
function countFor(bank: { byCategory: Record<string, { byLevel: Record<string, number> }> }, code: string, level: string): number {
  return bank.byCategory[code]?.byLevel?.[level] ?? 0;
}
