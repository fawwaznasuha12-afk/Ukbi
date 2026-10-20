import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

function createDb() {
  // Koneksi dikonfigurasi otomatis dari NETLIFY_DB_URL (dipakai hanya jika variabel itu tersedia).
  return drizzle({ schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;

/** Singleton per proses. Hanya boleh dipanggil saat NETLIFY_DB_URL tersedia. */
export function getDb(): Db {
  return (cached ??= createDb());
}
