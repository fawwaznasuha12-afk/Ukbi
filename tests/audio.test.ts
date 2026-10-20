import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { buildBank } from "../src/domain/questions/bank";
import { loadBankFiles, BANK_DIR } from "../src/lib/bank-loader";
import { sampleQuestions } from "../prisma/seed/sample-questions";

const sampleView = sampleQuestions.map((q) => ({ id: q.id, stem: q.stem, transcript: q.transcript, optionTexts: q.options.map((o) => o.text), status: q.status }));
const bank = buildBank(loadBankFiles(BANK_DIR), sampleView, new Date(0));
const listening = bank.records.filter((r) => r.categoryCode === "listening");
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

describe("audio soal listening", () => {
  it("setiap soal listening punya transkrip", () => {
    expect(listening.length).toBeGreaterThan(0);
    for (const r of listening) expect(r.transcript && r.transcript.length > 0).toBe(true);
  });

  it("setiap soal listening punya file MP3 dengan nama sesuai ID soal", () => {
    const missing = listening.filter((r) => !existsSync(path.join(AUDIO_DIR, `${r.id}.mp3`))).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it("soal non-listening tidak punya transkrip", () => {
    for (const r of bank.records.filter((x) => x.categoryCode !== "listening")) expect(r.transcript).toBeNull();
  });
});
