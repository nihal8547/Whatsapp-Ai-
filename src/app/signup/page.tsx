import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SignupForm from "./form";

export default async function SignupPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="text-ink-soft mt-1 text-sm">
          Two minutes to set up. You connect WhatsApp on the next screen.
        </p>
        <SignupForm />
        <p className="text-sm text-ink-soft mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-pine font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
