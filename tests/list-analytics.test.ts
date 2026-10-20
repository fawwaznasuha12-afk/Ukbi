import { describe, expect, it } from "vitest";
import { queryAndPaginate } from "../src/domain/session/list";
import { computeStats } from "../src/domain/analytics";

const rows = Array.from({ length: 13 }, (_, i) => ({
  id: `s${i}`,
  title: i % 2 === 0 ? `Latihan Genap ${i}` : `Latihan Ganjil ${i}`,
  status: i < 5 ? "COMPLETED" : "IN_PROGRESS",
  categoryCode: i % 3 === 0 ? "reading" : "writing",
  createdAt: new Date(2026, 0, i + 1),
}));

describe("queryAndPaginate", () => {
  it("paginate 10 per halaman dan menghitung jumlah halaman", () => {
    const p1 = queryAndPaginate(rows, { page: 1, pageSize: 10 });
    const p2 = queryAndPaginate(rows, { page: 2, pageSize: 10 });
    expect(p1.items).toHaveLength(10);
    expect(p2.items).toHaveLength(3);
    expect(p1.pageCount).toBe(2);
    expect(p1.total).toBe(13);
  });

  it("halaman di luar rentang dijepit ke halaman terakhir", () => {
    const p = queryAndPaginate(rows, { page: 99, pageSize: 10 });
    expect(p.page).toBe(2);
  });

  it("filter status, kategori, dan pencarian judul bekerja", () => {
    expect(queryAndPaginate(rows, { status: "COMPLETED" }).total).toBe(5);
    expect(queryAndPaginate(rows, { category: "reading" }).items.every((r) => r.categoryCode === "reading")).toBe(true);
    expect(queryAndPaginate(rows, { q: "genap" }).total).toBe(7);
  });

  it("urutan tanggal newest/oldest", () => {
    expect(queryAndPaginate(rows, { sort: "newest" }).items[0]!.id).toBe("s12");
    expect(queryAndPaginate(rows, { sort: "oldest" }).items[0]!.id).toBe("s0");
  });

  it("daftar kosong tetap punya 1 halaman", () => {
    const p = queryAndPaginate([], {});
    expect(p).toMatchObject({ total: 0, pageCount: 1, page: 1, items: [] });
  });
});

describe("computeStats", () => {
  it("rata-rata hanya dari sesi selesai yang punya persentase", () => {
    const s = computeStats([
      { createdAt: new Date(2026, 0, 1), status: "COMPLETED", percentage: 50, durationSec: 600 },
      { createdAt: new Date(2026, 0, 2), status: "COMPLETED", percentage: 100, durationSec: 300 },
      { createdAt: new Date(2026, 0, 3), status: "IN_PROGRESS", percentage: null, durationSec: 60 },
      { createdAt: new Date(2026, 0, 4), status: "COMPLETED", percentage: null, durationSec: 0 },
    ]);
    expect(s.completedCount).toBe(3);
    expect(s.averagePercentage).toBe(75);
    expect(s.totalMinutes).toBe(16);
    expect(s.trend.map((t) => t.percentage)).toEqual([50, 100]);
  });

  it("tanpa sesi selesai: rata-rata null, bukan NaN atau 0", () => {
    const s = computeStats([]);
    expect(s.averagePercentage).toBeNull();
    expect(s.completedCount).toBe(0);
  });

  it("nilai per kategori dihitung dari jumlah benar / dinilai", () => {
    const s = computeStats([
      {
        createdAt: new Date(2026, 0, 1), status: "COMPLETED", percentage: 50, durationSec: 0,
        breakdown: { reading: { scored: 2, correct: 1, percentage: 50 } },
      },
      {
        createdAt: new Date(2026, 0, 2), status: "COMPLETED", percentage: 100, durationSec: 0,
        breakdown: { reading: { scored: 2, correct: 2, percentage: 100 } },
      },
    ]);
    expect(s.categoryAverages.reading).toBe(75);
  });
});
