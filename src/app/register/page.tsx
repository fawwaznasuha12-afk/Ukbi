import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "../auth-actions";
import { currentUser } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="text-2xl font-semibold">Daftar</h1>
      {error && <p role="alert" className="rounded-lg notice-error">{error}</p>}
      <form action={registerAction} className="space-y-4 panel p-5">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="w-full rounded-lg border border-rule p-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sandi (minimal 8 karakter)</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded-lg border border-rule p-2" />
        </label>
        <button className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#174a44]">Daftar</button>
      </form>
      <p className="text-sm text-muted">Sudah punya akun? <Link href="/login" className="text-accent underline">Masuk</Link></p>
    </div>
  );
}
