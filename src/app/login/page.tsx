"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { login, saveSession } from "@/lib/api";

const ROLE_HOME: Record<string, string> = {
  TECHNICIAN: "/technician",
  PATHOLOGIST: "/pathologist",
  CLINICIAN: "/clinician",
  PATIENT: "/patient",
  ADMIN: "/admin",
};

const ROLES = ["Technician", "Pathologist", "Clinician", "Patient", "Admin"];

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    try {
      const session = await login(email, password);
      saveSession(session);
      router.push(ROLE_HOME[session.user.role] ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-full flex-1 bg-app text-navy lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ── Product statement ──────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url(/UniCanPredict.jpg)" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/30" aria-hidden />

        <div className="relative flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M12 3v6m0 6v6M5 12h4m6 0h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold">UniCanPredict</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance">
            Multi-organ histopathology classification.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Breast, lung, and colon tissue patches are read blind by a pathologist first. The model&apos;s
            prediction is revealed only after that read is locked.
          </p>
          <p className="mt-8 font-mono text-xs tabular-nums text-white/60">
            Research prototype. Not a medical device. Not for clinical use.
          </p>
        </div>
      </aside>

      {/* ── Sign in ────────────────────────────────────── */}
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M12 3v6m0 6v6M5 12h4m6 0h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-sm font-semibold">UniCanPredict</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-slate">
            Your role decides which workspace opens.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@hospital.org" autoComplete="username" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "h-11 w-full rounded-md text-sm font-medium text-white transition-colors",
                "bg-navy hover:bg-brand disabled:opacity-60",
              )}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-10 border-t border-line pt-6 text-sm text-slate">
            {ROLES.join(" · ")}
          </p>
        </div>
      </main>
    </div>
  );
}
