import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth-guard";
import { logoutAction } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Latihan UKBI (Demo)",
  description: "Latihan mandiri. Bukan produk resmi UKBI.",
};

const nav = [
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/practice", label: "Latihan baru" },
  { href: "/sessions", label: "Sesi" },
  { href: "/question-bank", label: "Bank soal" },
  { href: "/analytics", label: "Analisis" },
  { href: "/settings", label: "Pengaturan" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const items = user?.isAdmin ? [...nav, { href: "/admin/questions", label: "Admin soal" }] : nav;

  return (
    <html lang="id">
      <body>
        {user ? (
          <header className="border-b border-rule">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
              <div className="flex items-baseline gap-3">
                <Link href="/dashboard" className="serif text-lg font-semibold">Latihan UKBI</Link>
                <span className="text-xs text-muted">demo</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="hidden text-muted sm:inline">{user.email}</span>
                <form action={logoutAction}>
                  <button className="text-muted underline underline-offset-4 hover:text-ink">Keluar</button>
                </form>
              </div>
            </div>
            <nav className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-4 sm:px-8" aria-label="Utama">
              {items.map(({ href, label }) => (
                <Link key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent pb-3 text-sm text-muted hover:border-rule hover:text-ink">
                  {label}
                </Link>
              ))}
            </nav>
          </header>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">{children}</main>
        <footer className="px-4 sm:px-8">
          <p className="mx-auto max-w-5xl border-t border-rule py-6 text-xs text-muted">
            Aplikasi latihan independen. Bukan produk resmi atau penyelenggara UKBI. Angka yang ditampilkan adalah nilai latihan, bukan skor resmi.
          </p>
        </footer>
      </body>
    </html>
  );
}
