import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/domain/auth/password";
import { generateToken, hashToken } from "../src/domain/auth/tokens";
import { remainingSeconds } from "../src/domain/timer";
import { evaluateEssay } from "../src/domain/scoring/rubric";

describe("password", () => {
  it("verifikasi berhasil untuk sandi yang benar, gagal untuk yang salah", async () => {
    const h = await hashPassword("rahasia-123");
    expect(h).not.toContain("rahasia-123");
    expect(await verifyPassword("rahasia-123", h)).toBe(true);
    expect(await verifyPassword("salah", h)).toBe(false);
  });

  it("garam berbeda setiap kali, jadi hash berbeda untuk sandi sama", async () => {
    expect(await hashPassword("sama")).not.toBe(await hashPassword("sama"));
  });

  it("format hash rusak ditolak tanpa melempar error", async () => {
    expect(await verifyPassword("x", "bukan-hash")).toBe(false);
  });
});

describe("token", () => {
  it("token unik dan hash deterministik, token mentah tidak sama dengan hash", () => {
    const t = generateToken();
    expect(t).not.toBe(generateToken());
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });
});

describe("remainingSeconds", () => {
  const t0 = new Date("2026-10-01T10:00:00Z");

  it("tanpa batas waktu mengembalikan null", () => {
    expect(remainingSeconds({ timeLimitSec: null, durationSec: 0, activeSince: t0 }, t0)).toBeNull();
  });

  it("menghitung dari timestamp: 600 detik, aktif 120 detik lalu", () => {
    const now = new Date(t0.getTime() + 120_000);
    expect(remainingSeconds({ timeLimitSec: 600, durationSec: 0, activeSince: t0 }, now)).toBe(480);
  });

  it("menjumlahkan durasi yang sudah terakumulasi sebelumnya", () => {
    const now = new Date(t0.getTime() + 60_000);
    expect(remainingSeconds({ timeLimitSec: 600, durationSec: 300, activeSince: t0 }, now)).toBe(240);
  });

  it("tidak pernah negatif", () => {
    const now = new Date(t0.getTime() + 9_999_000);
    expect(remainingSeconds({ timeLimitSec: 600, durationSec: 0, activeSince: t0 }, now)).toBe(0);
  });

  it("sesi tidak aktif (dijeda) tidak mengurangi waktu", () => {
    const now = new Date(t0.getTime() + 9_999_000);
    expect(remainingSeconds({ timeLimitSec: 600, durationSec: 100, activeSince: null }, now)).toBe(500);
  });
});

describe("evaluateEssay", () => {
  const rubric = { minWords: 5, maxWords: 20, minSentences: 2, requiredKeywords: ["tabungan"] };

  it("teks kosong: skor 0, tanpa pembagian nol", () => {
    const r = evaluateEssay("   ", rubric);
    expect(r.score).toBe(0);
    expect(r.wordCount).toBe(0);
  });

  it("memenuhi semua kriteria: skor 100", () => {
    const r = evaluateEssay("Menabung itu penting. Tabungan membantu masa depan.", rubric);
    expect(r.score).toBe(100);
    expect(r.criteria.every((c) => c.passed)).toBe(true);
  });

  it("kata kunci tidak ada: skor turun dan alasan jelas", () => {
    const r = evaluateEssay("Menabung itu penting. Masa depan perlu dipikirkan.", rubric);
    const kw = r.criteria.find((c) => c.id === "kw-tabungan");
    expect(kw?.passed).toBe(false);
    expect(r.score).toBeLessThan(100);
  });

  it("melebihi batas kata gagal di kriteria maksimal", () => {
    const long = Array.from({ length: 30 }, () => "kata").join(" ") + ". Tabungan. Dua.";
    const r = evaluateEssay(long, rubric);
    expect(r.criteria.find((c) => c.id === "max-words")?.passed).toBe(false);
  });
});
