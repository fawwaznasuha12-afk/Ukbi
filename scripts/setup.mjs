#!/usr/bin/env node
/**
 * Dijalankan otomatis oleh `npm run dev` dan `npm start`. Tidak butuh langkah manual.
 *   - membuat folder data/ (database SQLite dibuat otomatis saat server pertama jalan)
 *   - membuat audio yang belum ada, jika espeak-ng dan ffmpeg terpasang
 *   - dengan --build: membangun aplikasi kalau belum pernah dibuild
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { generate, toolsAvailable } from "./build-audio.mjs";
import { BANK_LISTENING_IDS } from "./bank-ids.mjs";

const root = process.cwd();
const wantBuild = process.argv.includes("--build");

mkdirSync(path.join(root, "data"), { recursive: true });

// 1. Audio: hanya yang belum ada.
const missing = BANK_LISTENING_IDS().filter((id) => !existsSync(path.join(root, "public", "audio", `${id}.mp3`)));
if (missing.length > 0) {
  if (toolsAvailable()) {
    const r = generate();
    console.log(`[setup] audio: dibuat ${r.made}, gagal ${r.failed}`);
  } else {
    console.warn(`[setup] ${missing.length} file audio belum ada, dan espeak-ng/ffmpeg belum terpasang.`);
    console.warn("[setup] Soal listening itu akan menampilkan 'materi audio belum tersedia'. Lihat README untuk memasang alatnya.");
  }
}

// 2. Build untuk `npm start`.
if (wantBuild && !existsSync(path.join(root, ".next", "BUILD_ID"))) {
  console.log("[setup] aplikasi belum dibuild, membangun sekarang (sekali saja)...");
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  const r = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit", cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
