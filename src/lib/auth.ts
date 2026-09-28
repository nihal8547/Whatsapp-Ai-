import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { one } from "./db";

const COOKIE = "wa_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "change-me-in-env");

export type Session = {
  userId: number;
  tenantId: number | null;
  email: string;
  name: string;
  role: "owner" | "admin" | "staff";
  superAdmin: boolean;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function signIn(email: string, password: string): Promise<Session | null> {
  const u = await one(
    `SELECT u.id, u.tenant_id, u.email, COALESCE(u.full_name,'') AS full_name, u.role,
            u.is_super_admin, u.password_hash, t.status AS tenant_status
       FROM wa_tenant_users u
       LEFT JOIN wa_tenants t ON t.id = u.tenant_id
      WHERE lower(u.email) = lower($1)`,
    [email]
  );
  if (!u) return null;

  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return null;
  if (!u.is_super_admin && u.tenant_status === "cancelled") return null;

  const session: Session = {
    userId: u.id,
    tenantId: u.tenant_id,
    email: u.email,
    name: u.full_name || u.email,
    role: u.role,
    superAdmin: u.is_super_admin,
  };

  const token = await new SignJWT(session as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return session;
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError("unauthorized", 401);
  return s;
}

/**
 * Resolves the tenant a request is allowed to touch.
 * Staff are locked to their own tenant; a super admin may pass ?tenant=N.
 */
export async function requireTenant(req?: Request): Promise<{ session: Session; tenantId: number }> {
  const session = await requireSession();
  let tenantId = session.tenantId;
  if (session.superAdmin && req) {
    const asTenant = new URL(req.url).searchParams.get("tenant");
    if (asTenant) tenantId = Number(asTenant);
  }
  if (!tenantId) throw new AuthError("no_tenant_selected", 400);
  return { session, tenantId };
}

export async function requireOwner(req?: Request) {
  const ctx = await requireTenant(req);
  if (!ctx.session.superAdmin && ctx.session.role === "staff") {
    throw new AuthError("forbidden", 403);
  }
  return ctx;
}

export function errorResponse(e: unknown) {
  const status = e instanceof AuthError ? e.status : (e as any)?.status || 500;
  const message = e instanceof Error ? e.message : "server_error";
  if (status >= 500) console.error(e);
  return Response.json({ ok: false, error: message }, { status });
}
