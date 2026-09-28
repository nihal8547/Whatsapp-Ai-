import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./form";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-white p-12">
        <p className="font-medium">Webbea WhatsApp Desk</p>
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Your WhatsApp, answered in seconds — day or night.
          </h1>
          <p className="mt-5 text-white/70 leading-relaxed">
            An AI colleague greets every customer in their own language, answers what it knows,
            books appointments into your calendar, and hands the chat to you the moment a person
            is needed.
          </p>
        </div>
        <p className="text-sm text-white/50">Doha, Qatar</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-ink-soft mt-1 text-sm">Pick up where your chats left off.</p>
          <LoginForm />
          <p className="text-sm text-ink-soft mt-6">
            New here?{" "}
            <Link href="/signup" className="text-pine font-medium hover:underline">
              Create a workspace
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
