import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** ID semua soal listening di content/bank, dengan aturan penamaan yang sama dengan build-audio. */
export function BANK_LISTENING_IDS() {
  const dir = path.join(process.cwd(), "content", "bank");
  const ids = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const stem = name.replace(/\.json$/, "");
    JSON.parse(readFileSync(path.join(dir, name), "utf8")).forEach((item, index) => {
      if (item.c === "listening" && item.a) ids.push(`${stem}-${String(index + 1).padStart(3, "0")}`);
    });
  }
  return ids;
}
