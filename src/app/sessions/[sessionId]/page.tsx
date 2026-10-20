import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/lib/container";
import { requireUser } from "@/lib/auth-guard";
import { NotFoundError, modeLabel } from "@/services/practice";
import { statusLabel } from "@/lib/labels";
import { startAction, resumeAction } from "@/app/actions";
import { SessionRunner } from "./runner";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await params;
  let session;
  try {
    session = await getContainer().practice.getSession(user.id, sessionId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (session.status === "COMPLETED") redirect(`/results/${session.id}`);

  if (session.status === "NOT_STARTED") {
    return (
      <div className="max-w-xl space-y-4 panel p-6">
        <h1 className="text-xl font-semibold">{session.title}</h1>
        <p className="text-sm text-muted">#{session.sessionNumber} · {modeLabel(session.mode)} · {session.questionCount} soal · {statusLabel(session.status)}</p>
        <form action={async () => { "use server"; await startAction(session.id); }}>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#174a44]">Mulai Sesi</button>
        </form>
      </div>
    );
  }

  if (session.status === "PAUSED") {
    return (
      <div className="max-w-xl space-y-4 panel p-6">
        <h1 className="text-xl font-semibold">{session.title}</h1>
        <p className="text-sm text-muted">Sesi dijeda. Jawaban Anda tersimpan dan tidak berubah.</p>
        <form action={async () => { "use server"; await resumeAction(session.id); }}>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#174a44]">Lanjutkan</button>
        </form>
      </div>
    );
  }

  return <SessionRunner session={session} />;
}
