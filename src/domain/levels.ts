/** Jenjang soal. Disimpan sebagai kode di database, ditampilkan dengan label. */
export const LEVELS = ["SD", "SMP", "SMA_SMK", "KULIAH", "LANJUTAN"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  SD: "SD",
  SMP: "SMP",
  SMA_SMK: "SMA/SMK",
  KULIAH: "Kuliah",
  LANJUTAN: "Lanjutan",
};

/** Pilihan di form sesi: "SEMUA" tidak memfilter jenjang. */
export const ALL_LEVELS = "SEMUA" as const;
export type SessionLevel = Level | typeof ALL_LEVELS;

export function isLevel(x: unknown): x is Level {
  return typeof x === "string" && (LEVELS as readonly string[]).includes(x);
}

export function isSessionLevel(x: unknown): x is SessionLevel {
  return x === ALL_LEVELS || isLevel(x);
}

export function levelLabel(x: string): string {
  if (x === ALL_LEVELS) return "Semua jenjang";
  return isLevel(x) ? LEVEL_LABELS[x] : x;
}
