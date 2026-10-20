import { requireUser } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Pengaturan</h1>
      <div className="space-y-2 panel p-5 text-sm text-ink">
        <p><strong>Akun:</strong> {user.email}</p>
        <p><strong>Penyimpanan:</strong> SQLite (file data/app.db, atau APP_DB_FILE). Tidak perlu server database.</p>
        <p>Data tidak tersinkron antarperangkat. Database ini ada di server, bukan di browser.</p>
        <p>Sesi login berlaku 14 hari. Keluar menghapus token di server.</p>
      </div>
    </div>
  );
}
