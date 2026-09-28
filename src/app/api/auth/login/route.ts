import { signIn } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  const session = await signIn(String(email), String(password));
  if (!session) {
    return Response.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }
  return Response.json({ ok: true });
}
