/** Angka skor gaya Indonesia: 66,7. Null menjadi strip em. */
export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: Number.isInteger(n) ? 0 : 1 });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
