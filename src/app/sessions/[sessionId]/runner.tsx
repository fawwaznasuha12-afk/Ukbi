"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { saveAnswerAction, submitAction, pauseAction } from "@/app/actions";
import type { ClientSession } from "@/services/practice";
import { SIMULASI_SECTIONS, simulasiShortfall } from "@/domain/simulasi";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionRunner({ session }: { session: ClientSession }) {
  const [index, setIndex] = useState(session.lastIndex);
  const [items, setItems] = useState(session.items);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [remaining, setRemaining] = useState<number | null>(session.remainingSec);
  const [pending, startTransition] = useTransition();
  const item = items[index]!;
  const answered = items.filter((i) => i.response !== null).length;

  // Hitung mundur dari sisa waktu server. Saat 0, muat ulang: server akan mengirim sesi otomatis.
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  function persist(position: number, patch: { response?: string | null; flagged?: boolean }) {
    setItems((prev) => prev.map((i) => (i.position === position ? { ...i, ...patch } : i)));
    setSaveState("saving");
    const current = items[position];
    saveAnswerAction(session.id, {
      position,
      response: patch.response !== undefined ? patch.response : (current?.response ?? null),
      flagged: patch.flagged !== undefined ? patch.flagged : current?.flagged,
    })
      .then(() => setSaveState("saved"))
      .catch(() => {
        setSaveState("error");
        window.location.reload();
      });
  }

  function confirmSubmit() {
    if (!window.confirm(`Kirim sesi? ${answered} dari ${items.length} soal terjawab. Setelah dikirim, jawaban tidak bisa diubah.`)) return;
    startTransition(() => submitAction(session.id));
  }

  const timeWarning = remaining !== null && remaining <= 60;
  const shortfall = session.mode === "SIMULASI"
    ? simulasiShortfall(Object.fromEntries(SIMULASI_SECTIONS.map((x) => [x.categoryCode, items.filter((i) => i.categoryCode === x.categoryCode).length])))
    : [];

  return (
    <div className="space-y-4">
      {shortfall.length > 0 && (
        <p className="notice">
          Simulasi ini lebih pendek dari format Paket 1 karena bank soal belum lengkap: {shortfall.map((x) => `${x.label} ${x.have} dari ${x.target}`).join(", ")}.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <section className="space-y-5 panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>Soal {index + 1} dari {items.length}</span>
          <span aria-live="polite" className="text-xs">
            {saveState === "saving" && "Menyimpan…"}
            {saveState === "saved" && "Tersimpan"}
            {saveState === "error" && <span className="text-red-700">Gagal menyimpan. Memuat ulang…</span>}
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded bg-rule" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={items.length}>
          <div className="h-full bg-accent" style={{ width: `${(answered / items.length) * 100}%` }} />
        </div>

        <p className="text-xs uppercase tracking-wide text-muted">{item.categoryCode}{item.isEssay ? " · esai" : ""}</p>
        {item.categoryCode === "listening" && (
          item.audioUrl ? (
            <div className="space-y-2">
              <audio key={item.position} controls preload="none" src={item.audioUrl} className="w-full" aria-label={`Audio soal ${index + 1}`} />
              <p className="text-xs text-muted">Dengarkan audio sampai selesai, lalu pilih jawaban.</p>
            </div>
          ) : (
            <p className="notice">Materi audio belum tersedia untuk soal ini.</p>
          )
        )}
        <h2 className="text-lg leading-relaxed">{item.stem}</h2>

        {!item.isEssay ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Pilihan jawaban</legend>
            {item.options.map((o) => (
              <label key={o.label} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${item.response === o.label ? "border-accent bg-accent-soft" : "border-rule"}`}>
                <input
                  type="radio"
                  name={`q-${item.position}`}
                  value={o.label}
                  checked={item.response === o.label}
                  onChange={() => persist(item.position, { response: o.label })}
                  className="mt-0.5 accent-accent"
                />
                <span><strong>{o.label}.</strong> {o.text}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <EssayBox key={item.position} initial={item.response ?? ""} onSave={(text) => persist(item.position, { response: text || null })} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg border border-rule px-3 py-2 text-sm disabled:opacity-40">← Sebelumnya</button>
            <button type="button" disabled={index === items.length - 1} onClick={() => setIndex(index + 1)} className="rounded-lg border border-rule px-3 py-2 text-sm disabled:opacity-40">Berikutnya →</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={item.flagged} onChange={(e) => persist(item.position, { flagged: e.target.checked })} className="accent-amber-600" />
            Tandai untuk ditinjau
          </label>
        </div>
      </section>

      <aside className="space-y-4 panel p-4 text-sm">
        {remaining !== null && (
          <div className={`rounded-lg p-3 text-center ${timeWarning ? "bg-red-50 text-red-800" : "bg-paper"}`} role="timer" aria-label="Sisa waktu">
            <p className="text-xs uppercase tracking-wide">Sisa waktu</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(remaining)}</p>
          </div>
        )}
        <p className="font-medium">Navigasi soal</p>
        <div className="grid grid-cols-5 gap-2">
          {items.map((i, n) => (
            <button
              key={i.position}
              type="button"
              onClick={() => setIndex(n)}
              aria-label={`Soal ${n + 1}${i.response ? ", terjawab" : ""}${i.flagged ? ", ditandai" : ""}`}
              className={`rounded-md border py-1.5 text-xs ${n === index ? "border-accent font-semibold" : "border-rule"} ${i.response ? "bg-accent-soft" : ""} ${i.flagged ? "ring-2 ring-amber-400" : ""}`}
            >
              {n + 1}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Terjawab {answered} dari {items.length}.</p>
        <div className="flex flex-col gap-2 pt-2">
          <button type="button" disabled={pending} onClick={() => startTransition(() => pauseAction(session.id))} className="rounded-lg border border-rule px-3 py-2">
            Jeda sesi
          </button>
          <button type="button" disabled={pending} onClick={confirmSubmit} className="rounded-lg bg-accent px-3 py-2 text-white disabled:opacity-50">
            Kirim sesi
          </button>
          <Link href="/sessions" className="text-center text-xs text-muted underline">Kembali ke daftar sesi</Link>
        </div>
      </aside>
      </div>
    </div>
  );
}

function EssayBox({ initial, onSave }: { initial: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-2">
      <label htmlFor="essay" className="sr-only">Jawaban esai</label>
      <textarea
        id="essay"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
        className="min-h-48 w-full rounded-lg border border-rule p-3 text-sm"
      />
      <p className="text-xs text-muted">{words} kata. Jawaban disimpan saat Anda keluar dari kotak ini.</p>
    </div>
  );
}
