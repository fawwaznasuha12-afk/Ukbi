import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getContainer } from "./container";

export const SESSION_COOKIE = "ukbi_session";

export interface CurrentUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export async function currentUser(): Promise<CurrentUser | null> {
  const { auth, adminEmails } = getContainer();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = await auth.resolve(token);
  if (!userId) return null;
  const user = await auth.getUser(userId);
  if (!user) return null;
  return { id: user.id, email: user.email, isAdmin: adminEmails.includes(user.email) };
}

/** Dipakai di setiap halaman yang butuh login. Tanpa user → redirect ke /login. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/dashboard");
  return u;
}
