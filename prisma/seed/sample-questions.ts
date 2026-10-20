import type { QuestionRecord } from "../../src/repositories/types";
import type { Rubric } from "../../src/domain/scoring/rubric";
import type { Level } from "../../src/domain/levels";

/** Jenjang sampel (keputusan editorial, bisa diubah lewat admin). */
const SAMPLE_LEVEL: Record<string, Level> = {
  "lr-001": "SMP", "lr-002": "SMP", "lr-003": "SD", "lr-004": "SMP", "lr-005": "KULIAH", "lr-006": "SMP",
  "rd-001": "SD", "rd-002": "SMA_SMK", "rd-003": "SD", "rd-004": "SMP", "rd-005": "SMA_SMK",
  "ls-001": "SD", "ls-002": "SD", "ls-003": "SMP", "ls-004": "SMA_SMK",
  "wr-001": "SMA_SMK", "wr-002": "SMP",
};

const ESSAY_RUBRICS: Record<string, Rubric> = {
  "wr-001": { minWords: 30, maxWords: 150, minSentences: 4, requiredKeywords: ["membaca"] },
  "wr-002": { minWords: 25, maxWords: 120, minSentences: 3, requiredKeywords: ["menabung"] },
};


const mk = (id: string, categoryCode: string, type: string, difficulty: QuestionRecord["difficulty"],
  stem: string, options: [string, string, string?][], answerKey: string | null, explanation: string): SeedItem => ({
  id, version: 1, categoryCode, type, difficulty, status: "ACTIVE", stem, explanation, answerKey,
  options: options.map(([text], i) => ({ label: "ABC"[i]!, text, isCorrect: "ABC"[i] === answerKey })),
});

const more: SeedItem[] = [
  mk("lr-003", "language_rules", "MULTIPLE_CHOICE", "EASY", "Pilih kalimat yang efektif.",
    [["Kami sangat sangat senang sekali.", ""], ["Kami sangat senang.", ""], ["Kami senang sekali sekali.", ""]],
    "B", "Kata 'sangat' dan 'sekali' berlebihan jika digabung dalam satu makna."),
  mk("lr-004", "language_rules", "MULTIPLE_CHOICE", "MEDIUM", "Pilih ejaan yang benar.",
    [["resiko", ""], ["risiko", ""], ["resyiko", ""]], "B", "Bentuk baku: 'risiko'."),
  mk("lr-005", "language_rules", "MULTIPLE_CHOICE", "HARD", "Pilih penggunaan preposisi yang tepat.",
    [["Buku itu untuk daripada saya.", ""], ["Buku itu untuk saya.", ""], ["Buku itu buat daripada saya.", ""]],
    "B", "Tidak perlu menumpuk preposisi yang bermakna sama."),
  mk("lr-006", "language_rules", "MULTIPLE_CHOICE", "MEDIUM", "Pilih tanda baca yang tepat untuk daftar belanja: telur, susu, roti.",
    [["telur; susu; roti", ""], ["telur, susu, roti", ""], ["telur. susu. roti", ""]], "B", "Pemisah unsur dalam rangkaian memakai koma."),
  mk("rd-003", "reading", "READING_MC", "EASY", "Bacaan: Perpustakaan desa kini buka setiap hari, termasuk Minggu. Perpustakaan itu buka pada hari apa saja?",
    [["Setiap hari", ""], ["Hanya Senin", ""], ["Hari kerja saja", ""]], "A", "Teks menyebut buka setiap hari."),
  mk("rd-004", "reading", "READING_MC", "MEDIUM", "Bacaan: Hutan mangrove melindungi pantai dari abrasi. Apa fungsi utama mangrove dalam bacaan?",
    [["Melindungi pantai", ""], ["Menambah daratan", ""], ["Menghasilkan kayu bakar", ""]], "A", "Teks menekankan perlindungan pantai dari abrasi."),
  mk("rd-005", "reading", "READING_MC", "HARD", "Bacaan: Kebiasaan membaca sejak dini membentuk kosakata yang luas. Simpulan yang paling tepat adalah...",
    [["Kosakata tidak dipengaruhi kebiasaan.", ""], ["Membaca dini berpengaruh pada kosakata.", ""], ["Kosakata hanya diperoleh di sekolah.", ""]], "B", "Inferensi langsung dari hubungan sebab-akibat dalam teks."),
  mk("ls-002", "listening", "MULTIPLE_CHOICE", "EASY", "Transkrip: 'Harga tiket masuk dua puluh ribu rupiah.' Berapa harga tiket?",
    [["Dua puluh ribu rupiah", ""], ["Dua belas ribu rupiah", ""]], "A", "Angka disebut langsung dalam transkrip."),
  mk("ls-003", "listening", "MULTIPLE_CHOICE", "MEDIUM", "Transkrip: 'Saya tidak setuju, tetapi saya menghormati keputusan itu.' Sikap penutur adalah...",
    [["Menolak keputusan", ""], ["Tidak setuju namun menghormati", ""], ["Setuju sepenuhnya", ""]], "B", "Penutur menyatakan ketidaksetujuan sekaligus penghormatan."),
  mk("ls-004", "listening", "MULTIPLE_CHOICE", "HARD", "Transkrip: 'Kalau hujan terus, panen mungkin mundur, tapi bibit sudah kami siapkan.' Maksud penutur tentang persiapan adalah...",
    [["Persiapan dibatalkan", ""], ["Persiapan sudah dilakukan", ""], ["Persiapan belum dimulai", ""]], "B", "Frasa 'sudah kami siapkan' menunjukkan persiapan telah berjalan."),
  mk("wr-002", "writing", "ESSAY", "MEDIUM", "Tulis paragraf 4 kalimat tentang pentingnya menabung.", [], null, "Dinilai dengan rubrik."),
];

/**
 * SAMPEL ORISINAL untuk demo. Bukan soal resmi UKBI.
 * Dipisah dari kode aplikasi agar bisa diganti dengan bank soal sendiri.
 */
type SeedItem = Omit<QuestionRecord, "rubric" | "updatedAt" | "source" | "level" | "transcript"> & { rubric?: Rubric | null; updatedAt?: Date; source?: string; level?: Level; transcript?: string | null };

const seedBase: SeedItem[] = [
  {
    id: "lr-001", version: 1, categoryCode: "language_rules", type: "MULTIPLE_CHOICE",
    difficulty: "EASY", status: "ACTIVE", explanation: "Bentuk baku dari 'analisa' adalah 'analisis'.",
    stem: "Manakah bentuk baku kata berikut?",
    options: [
      { label: "A", text: "analisa", isCorrect: false },
      { label: "B", text: "analisis", isCorrect: true },
      { label: "C", text: "analisys", isCorrect: false },
    ],
    answerKey: "B",
  },
  {
    id: "lr-002", version: 1, categoryCode: "language_rules", type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM", status: "ACTIVE", explanation: "'Di' sebagai awalan ditulis serangkai dengan kata kerjanya.",
    stem: "Pilih penulisan yang benar.",
    options: [
      { label: "A", text: "di ambil", isCorrect: false },
      { label: "B", text: "diambil", isCorrect: true },
    ],
    answerKey: "B",
  },
  {
    id: "rd-001", version: 1, categoryCode: "reading", type: "READING_MC",
    difficulty: "MEDIUM", status: "ACTIVE", explanation: "Teks menyebut kenaikan produksi, bukan penurunan.",
    stem: "Bacaan: Produksi padi di desa itu naik setelah irigasi diperbaiki. Apa gagasan utama bacaan?",
    options: [
      { label: "A", text: "Irigasi memengaruhi hasil panen.", isCorrect: true },
      { label: "B", text: "Desa itu kekurangan air.", isCorrect: false },
    ],
    answerKey: "A",
  },
  {
    id: "rd-002", version: 1, categoryCode: "reading", type: "READING_MC",
    difficulty: "HARD", status: "ACTIVE", explanation: "Inferensi: pembangunan berkelanjutan memerlukan perencanaan jangka panjang.",
    stem: "Bacaan: Pembangunan berkelanjutan menuntut perencanaan jangka panjang. Simpulan yang tepat adalah...",
    options: [
      { label: "A", text: "Perencanaan singkat sudah cukup.", isCorrect: false },
      { label: "B", text: "Perencanaan jangka panjang penting.", isCorrect: true },
    ],
    answerKey: "B",
  },
  {
    id: "ls-001", version: 1, categoryCode: "listening", type: "MULTIPLE_CHOICE",
    difficulty: "EASY", status: "ACTIVE", explanation: "Penutur menyatakan rapat dipindah ke Kamis.",
    stem: "Transkrip: 'Rapat kita pindah ke hari Kamis.' Kapan rapat dilaksanakan?",
    options: [
      { label: "A", text: "Senin", isCorrect: false },
      { label: "B", text: "Kamis", isCorrect: true },
    ],
    answerKey: "B",
  },
  {
    id: "wr-001", version: 1, categoryCode: "writing", type: "ESSAY",
    difficulty: "HARD", status: "ACTIVE", explanation: "Dinilai dengan rubrik, tidak dinilai otomatis.",
    stem: "Tulis paragraf 5 kalimat tentang manfaat membaca.",
    options: [],
    answerKey: null,
  },
];

const epoch = new Date("2026-01-01T00:00:00Z");
/** Soal listening dipindah ke content/bank (butuh transkrip dan audio). */
export const sampleQuestions: QuestionRecord[] = [...seedBase, ...more].filter((q) => q.categoryCode !== "listening").map((q) => ({
  ...q,
  source: q.source ?? "sampel-orisinal",
  level: SAMPLE_LEVEL[q.id] ?? q.level ?? "SMP",
  transcript: q.transcript ?? null,
  rubric: ESSAY_RUBRICS[q.id] ?? q.rubric ?? null,
  updatedAt: q.updatedAt ?? epoch,
}));
