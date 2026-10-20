import { hashPassword, verifyPassword } from "../domain/auth/password";

// Hash dummy untuk menyamakan waktu respons saat email tidak terdaftar.
const dummyHash = hashPassword("dummy-sandi-tidak-dipakai");
import { generateToken, hashToken } from "../domain/auth/tokens";
import type { AuthTokenRepository, UserRecord, UserRepository } from "../repositories/types";
import { randomUUID } from "node:crypto";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthDeps {
  users: UserRepository;
  tokens: AuthTokenRepository;
  now?: () => Date;
  newId?: () => string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAdminEmail(email: string, adminList: string[]): boolean {
  return adminList.includes(email.toLowerCase());
}

export function createAuthService(deps: AuthDeps) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;
  // Batas percobaan login per email (in-memory; cukup untuk satu proses).
  const failures = new Map<string, { count: number; lockedUntil: number }>();

  async function issueToken(userId: string): Promise<string> {
    const token = generateToken();
    await deps.tokens.add({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(now().getTime() + SESSION_TTL_MS),
    });
    return token;
  }

  return {
    async register(rawEmail: string, password: string): Promise<{ token: string; userId: string }> {
      const email = rawEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 200) throw new AuthError("Format email tidak valid.");
      if (password.length < 8 || password.length > 200) throw new AuthError("Sandi harus 8–200 karakter.");
      if (await deps.users.findByEmail(email)) throw new AuthError("Email sudah terdaftar.");
      const user: UserRecord = {
        id: newId(),
        email,
        passwordHash: await hashPassword(password),
        createdAt: now(),
      };
      await deps.users.create(user);
      return { token: await issueToken(user.id), userId: user.id };
    },

    async login(rawEmail: string, password: string): Promise<{ token: string; userId: string }> {
      const email = rawEmail.trim().toLowerCase();
      const at = now().getTime();
      const f = failures.get(email);
      if (f && f.lockedUntil > at) {
        throw new AuthError("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
      }

      const user = await deps.users.findByEmail(email);
      // Tetap menjalankan verifikasi walau email tidak ada, supaya waktu respons tidak membocorkan keberadaan akun.
      let ok = false;
      if (user) {
        ok = await verifyPassword(password, user.passwordHash);
      } else {
        await verifyPassword(password, await dummyHash);
      }

      if (!user || !ok) {
        const count = (f?.count ?? 0) + 1;
        failures.set(email, { count, lockedUntil: count >= MAX_FAILURES ? at + LOCK_MS : 0 });
        throw new AuthError("Email atau sandi salah.");
      }
      failures.delete(email);
      return { token: await issueToken(user.id), userId: user.id };
    },

    /** Mengembalikan userId jika token valid dan belum kedaluwarsa. */
    async resolve(token: string | undefined): Promise<string | null> {
      if (!token) return null;
      const rec = await deps.tokens.find(hashToken(token));
      if (!rec) return null;
      if (rec.expiresAt.getTime() <= now().getTime()) {
        await deps.tokens.remove(rec.tokenHash);
        return null;
      }
      return rec.userId;
    },

    async logout(token: string | undefined): Promise<void> {
      if (token) await deps.tokens.remove(hashToken(token));
    },

    getUser: (id: string) => deps.users.findById(id),
  };
}
