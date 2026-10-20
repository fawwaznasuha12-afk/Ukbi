#!/usr/bin/env node
/**
 * Membuat audio MP3 untuk setiap soal listening dari transkripnya.
 *
 * Mesin: espeak-ng dengan voice mbrola-id1, lalu ffmpeg.
 *   Linux : sudo apt install espeak-ng mbrola mbrola-id1 ffmpeg
 *   macOS : brew install espeak-ng mbrola ffmpeg   (voice mbrola-id1 perlu dipasang manual)
 *   Windows: pasang espeak-ng dan ffmpeg, lalu pastikan keduanya ada di PATH.
 *
 * Nama file = ID soal, public/audio/<id>.mp3. File yang sudah ada tidak dibuat ulang,
 * kecuali dengan --force.
 *
 * Perbaikan dibanding versi awal: transkrip dipecah per kalimat, ada jeda di antara kalimat,
 * kecepatan sedikit diturunkan, dan volume dinormalisasi. Suaranya tetap sintetis.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const bankDir = path.join(root, "content", "bank");
const outDir = path.join(root, "public", "audio");
const VOICE = process.env.AUDIO_VOICE ?? "mb/mb-id1";
const SPEED = process.env.AUDIO_SPEED ?? "135";
const force = process.argv.includes("--force");

const PAUSE_SEC = 0.45; // jeda antar kalimat
const LEAD_SEC = 0.4;   // jeda di awal dan akhir

/** Pastikan alat tersedia. Kembalikan false tanpa melempar error, supaya npm start/dev tetap jalan. */
export function toolsAvailable() {
  const ok = (cmd) => spawnSync(cmd, ["-h"], { stdio: "ignore" }).error === undefined;
  return ok("espeak-ng") && ok("ffmpeg");
}

/** Pecah transkrip per kalimat. Tanda baca tetap dipertahankan agar intonasi terbaca. */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ff(args) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "pipe" });
}

export function renderTranscript(text, id, tmp) {
  const parts = splitSentences(text);
  const segs = [];
  parts.forEach((sentence, i) => {
    const wav = path.join(tmp, `${id}-${i}.wav`);
    execFileSync("espeak-ng", ["-v", VOICE, "-s", SPEED, "-w", wav, sentence], { stdio: "pipe" });
    segs.push(wav);
  });

  // Jeda sebagai file wav mono 16 kHz, sama dengan keluaran mbrola.
  const silence = (sec, name) => {
    const p = path.join(tmp, name);
    ff(["-f", "lavfi", "-i", `anullsrc=r=16000:cl=mono`, "-t", String(sec), p]);
    return p;
  };
  const lead = silence(LEAD_SEC, `${id}-lead.wav`);
  const pause = silence(PAUSE_SEC, `${id}-pause.wav`);
  const order = [lead];
  segs.forEach((s, i) => {
    if (i > 0) order.push(pause);
    order.push(s);
  });
  order.push(lead);

  const list = path.join(tmp, `${id}-list.txt`);
  writeFileSync(list, order.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const joined = path.join(tmp, `${id}-joined.wav`);
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  return joined;
}

export function generate({ force: forceAll = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  const tmp = path.join(os.tmpdir(), `ukbi-audio-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  let made = 0, skipped = 0, failed = 0;
  try {
    for (const name of readdirSync(bankDir).filter((f) => f.endsWith(".json")).sort()) {
      const stem = name.replace(/\.json$/, "");
      const items = JSON.parse(readFileSync(path.join(bankDir, name), "utf8"));
      items.forEach((item, index) => {
        if (item.c !== "listening" || !item.a) return;
        const id = `${stem}-${String(index + 1).padStart(3, "0")}`;
        const out = path.join(outDir, `${id}.mp3`);
        if (existsSync(out) && !forceAll) { skipped++; return; }
        try {
          const joined = renderTranscript(item.a, id, tmp);
          // Normalisasi loudness ke -16 LUFS, lalu MP3 mono 22 kHz 64 kbps.
          ff(["-i", joined, "-af", "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=7", "-ac", "1", "-ar", "22050",
            "-codec:a", "libmp3lame", "-b:a", "64k", out]);
          made++;
        } catch (e) {
          failed++;
          console.error(`gagal: ${id}: ${String(e.message).split("\n")[0]}`);
        }
      });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { made, skipped, failed };
}

// Dijalankan langsung: node scripts/build-audio.mjs [--force]
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  if (!toolsAvailable()) {
    console.error("espeak-ng atau ffmpeg belum terpasang. Lewati pembuatan audio; file yang sudah ada tetap dipakai.");
    process.exitCode = 0;
  } else {
    const r = generate({ force });
    console.log(`audio: dibuat ${r.made}, dilewati ${r.skipped}, gagal ${r.failed} (folder public/audio)`);
    process.exitCode = r.failed ? 1 : 0;
  }
}
