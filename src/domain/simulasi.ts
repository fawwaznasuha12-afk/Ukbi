/**
 * Format simulasi Paket 1 berdasarkan sumber sekunder tentang UKBI Adaptif (2026).
 * Ini bukan format resmi yang diverifikasi dari situs Kemendikdasmen. Cek ulang sebelum dipakai sebagai acuan.
 */
export const SIMULASI_SECTIONS = [
  { categoryCode: "listening", label: "Mendengarkan", target: 40, minutes: 30 },
  { categoryCode: "language_rules", label: "Merespons Kaidah", target: 25, minutes: 25 },
  { categoryCode: "reading", label: "Membaca", target: 40, minutes: 45 },
] as const;

export const SIMULASI_TOTAL_SECONDS = SIMULASI_SECTIONS.reduce((s, x) => s + x.minutes, 0) * 60;

/** Bagian yang jumlah soalnya di bawah target. Kosong jika simulasi lengkap. */
export function simulasiShortfall(counts: Record<string, number>): { label: string; have: number; target: number }[] {
  return SIMULASI_SECTIONS.filter((s) => (counts[s.categoryCode] ?? 0) < s.target).map((s) => ({
    label: s.label,
    have: counts[s.categoryCode] ?? 0,
    target: s.target,
  }));
}
