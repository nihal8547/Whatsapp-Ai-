import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import SignupForm from "./form";

export const dynamic = "force-dynamic";

export type PlanItem = {
  id: number;
  code: string;
  name: string;
  price_qar: number;
  monthly_reply_limit: number | null;
  broadcast_limit: number;
  features: string[];
  is_popular: boolean;
};

export default async function SignupPage() {
  if (await getSession()) redirect("/");

  const plans = await q<PlanItem>(
    `SELECT id, code, name, price_qar, monthly_reply_limit, broadcast_limit, features, is_popular
     FROM wa_plans
     WHERE active = true AND code != 'internal'
     ORDER BY price_qar ASC`
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 my-6">
      <div className="w-full max-w-5xl">
        <SignupForm initialPlans={plans} />
        <p className="text-sm text-ink-soft mt-6 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-pine font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
