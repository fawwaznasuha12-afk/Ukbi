"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getContainer } from "@/lib/container";
import { SESSION_COOKIE } from "@/lib/auth-guard";
import { AuthError, SESSION_TTL_MS } from "@/services/auth";

async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.COOKIE_SECURE === "1",
  });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    const { token } = await getContainer().auth.login(email, password);
    await setSessionCookie(token);
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : "Gagal masuk.";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    const { token } = await getContainer().auth.register(email, password);
    await setSessionCookie(token);
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : "Gagal mendaftar.";
    redirect(`/register?error=${encodeURIComponent(msg)}`);
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await getContainer().auth.logout(token);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
