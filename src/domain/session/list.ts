export interface ListableSession {
  id: string;
  title: string;
  status: string;
  categoryCode: string | null;
  createdAt: Date;
}

export interface ListQuery {
  q?: string;
  status?: string;
  category?: string;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

/** Filter, cari, urutkan, lalu paginate. Murni, tanpa I/O. */
export function queryAndPaginate<T extends ListableSession>(rows: readonly T[], query: ListQuery): Page<T> {
  const q = query.q?.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (q && !r.title.toLowerCase().includes(q)) return false;
    if (query.status && r.status !== query.status) return false;
    if (query.category && r.categoryCode !== query.category) return false;
    return true;
  });
  out = out.sort((a, b) =>
    query.sort === "oldest"
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const pageSize = Math.max(1, query.pageSize ?? 10);
  const total = out.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  const start = (page - 1) * pageSize;
  return { items: out.slice(start, start + pageSize), page, pageCount, total };
}
