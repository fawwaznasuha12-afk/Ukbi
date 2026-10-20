import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { NotFoundError, modeLabel } from "@/services/practice";
import { categoryLabels } from "@/lib/labels";
import { formatScore, formatDateTime } from "@/lib/format";
import { levelLabel } from "@/domain/levels";

export const dynamic = "force-dynamic";

interface Essay {
  position: number;
  questionId: string;
  evaluation: {
    score: number;
    wordCount: number;
    sentenceCount: number;
    criteria: { id: string; label: string; passed: boolean; reason: string }[];
  };
}

interface Result {
  essays?: Essay[];
  scoredCount: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percentage: number | null;
  finalScore?: number | null;
  finalDetail?: {
    finalScore: number | null;
    gradedCount: number;
    objectiveCorrect: number;
    objectiveTotal: number;
    essayAverage: number | null;
    essayCount: number;
  };
  breakdown: Record<string, { scored: number; correct: number; percentage: number | null }>;
}

export default async function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await params;
  let s;
  try {
    s = await getContainer().practice.getSession(user.id, sessionId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (s.status !== "COMPLETED") redirect(`/sessions/${s.id}`);
  const r = s.result as Result;
  const score = r.finalScore ?? r.percentage ?? null;
  const d = r.finalDetail;

  return (
    <div className="space-y-14">
      <header className="space-y-2">
        <p className="text-sm text-muted">
          Sesi #{s.sessionNumber} · {modeLabel(s.mode)} · {levelLabel(s.level)}{s.completedAt ? ` · ${formatDateTime(s.completedAt)}` : ""}
        </p>
        <h1 className="serif text-3xl">{s.title}</h1>
      </header>

      <section className="grid gap-10 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <p className="text-sm text-muted">Skor akhir latihan</p>
          <p className="serif text-7xl tabular-nums leading-none">{formatScore(score)}</p>
          <p className="mt-2 text-xs text-muted">Nilai latihan, bukan skor resmi UKBI.</p>
        </div>
        <div className="space-y-4 text-sm">
          <div className="pb-6"><ScoreBar value={score} /></div>
          {d && d.gradedCount > 0 ? (
            <p className="text-muted">
              Dihitung dari {d.gradedCount} soal dengan bobot sama.
              {d.objectiveTotal > 0 && <> Pilihan ganda: {d.objectiveCorrect} dari {d.objectiveTotal} benar.</>}
              {d.essayCount > 0 && <> Esai: rata-rata {formatScore(d.essayAverage)} berdasarkan rubrik.</>}
            </p>
          ) : (
            <p className="text-muted">Tidak ada soal yang dinilai otomatis dalam sesi ini.</p>
          )}
          <dl className="grid grid-cols-3 gap-4 border-t border-rule pt-4">
            <Stat label="Benar" value={r.correct} />
            <Stat label="Salah" value={r.wrong} />
            <Stat label="Kosong" value={r.unanswered} />
          </dl>
        </div>
      </section>

      {Object.keys(r.breakdown).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Per kategori</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-rule">
                <th className="py-2 font-normal">Kategori</th>
                <th className="py-2 text-right font-normal">Benar</th>
                <th className="py-2 text-right font-normal">Ketepatan</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.breakdown).map(([code, v]) => (
                <tr key={code} className="border-b border-rule">
                  <td className="py-3">{categoryLabels[code] ?? code}</td>
                  <td className="py-3 text-right tabular-nums">{v.correct} dari {v.scored}</td>
                  <td className="py-3 text-right tabular-nums">{formatScore(v.percentage)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(r.essays?.length ?? 0) > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold">Penilaian esai</h2>
            <p className="mt-1 text-sm text-muted">
              Rubrik ini hanya memeriksa jumlah kata, jumlah kalimat, dan kata kunci. Mutu gagasan tidak dinilai.
            </p>
          </div>
          {r.essays!.map((e) => (
            <div key={e.questionId} className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">Soal {e.position + 1}</span>
                <span className="text-muted"> · skor {formatScore(e.evaluation.score)} · {e.evaluation.wordCount} kata, {e.evaluation.sentenceCount} kalimat</span>
              </p>
              <ul className="divide-y divide-rule border-y border-rule text-sm">
                {e.evaluation.criteria.map((c) => (
                  <li key={c.id} className="flex justify-between gap-4 py-2">
                    <span>{c.label}</span>
                    <span className={c.passed ? "text-accent" : "text-miss"}>{c.passed ? "Terpenuhi" : "Belum"} <span className="text-muted">({c.reason})</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section id="pembahasan" className="space-y-6">
        <h2 className="text-sm font-semibold">Pembahasan</h2>
        <ol className="divide-y divide-rule border-y border-rule">
          {s.items.map((i) => {
            const graded = i.correctLabel !== null;
            const verdict = !graded ? null : i.response === null ? "Kosong" : i.response === i.correctLabel ? "Benar" : "Salah";
            return (
              <li key={i.position} className="space-y-2 py-5 text-sm">
                <p className="flex flex-wrap gap-x-3">
                  <span className="tabular-nums text-muted">{i.position + 1}.</span>
                  <span className="font-medium">{i.stem}</span>
                </p>
                {graded && (
                  <p className="text-muted">
                    Jawaban Anda: <span className="text-ink">{i.response ?? "tidak diisi"}</span> · Kunci: <span className="text-ink">{i.correctLabel}</span>{" "}
                    <span className={verdict === "Benar" ? "text-accent" : "text-miss"}>· {verdict}</span>
                  </p>
                )}
                {i.transcript && (
                  <p className="text-muted"><span className="text-ink">Transkrip audio:</span> {i.transcript}</p>
                )}
                {i.explanation && <p className="text-ink/80">{i.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <Link href="/sessions" className="link text-sm">Kembali ke daftar sesi</Link>
    </div>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  return (
    <div className="relative h-px bg-rule" role="img" aria-label={value === null ? "Belum ada skor" : `Skor ${formatScore(value)} dari 100`}>
      {value !== null && (
        <span className="absolute -top-[5px] h-[11px] w-[2px] bg-accent" style={{ left: `${Math.min(100, Math.max(0, value))}%` }} />
      )}
      <span className="absolute left-0 top-3 text-xs text-muted">0</span>
      <span className="absolute right-0 top-3 text-xs text-muted">100</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="serif mt-1 text-xl tabular-nums">{value}</dd>
    </div>
  );
}
