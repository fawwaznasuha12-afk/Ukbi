export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    NOT_STARTED: "Belum dimulai",
    IN_PROGRESS: "Sedang dikerjakan",
    PAUSED: "Dijeda",
    COMPLETED: "Selesai",
    CANCELLED: "Dibatalkan",
  };
  return map[status] ?? status;
}

export const categoryLabels: Record<string, string> = {
  listening: "Mendengarkan",
  language_rules: "Merespons Kaidah",
  reading: "Membaca",
  writing: "Menulis",
  speaking: "Berbicara",
};
