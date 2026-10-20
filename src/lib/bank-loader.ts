import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { BankFile } from "../domain/questions/bank";

/** Membaca semua berkas bank JSON dalam urutan nama. */
export function loadBankFiles(dir: string): BankFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((name) => ({
      name,
      items: JSON.parse(readFileSync(path.join(dir, name), "utf8")) as BankFile["items"],
    }));
}

export const BANK_DIR = path.join(process.cwd(), "content", "bank");
