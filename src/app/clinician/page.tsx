"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  clearSession,
  getSession,
  imageUrl,
  listCases,
  type AuthUser,
  type CaseRecord,
} from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-accent-soft text-brand",
  DIAGNOSED: "bg-brand/10 text-brand",
};

export default function ClinicianPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "CLINICIAN") {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    listCases(session.token)
      .then(setCases)
      .finally(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  return (
    <main className="flex flex-1 flex-col bg-app px-4 py-10 text-navy">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Clinician — Diagnosis & Release
            </h1>
            <p className="mt-1 text-sm text-slate">
              Signed in as {user.name}
            </p>
          </div>
          <button
            onClick={() => {
              clearSession();
              router.push("/login");
            }}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-slate hover:bg-line/60"
          >
            Sign out
          </button>
        </div>

        <div className="mt-8 space-y-3">
          {loading && <p className="text-sm text-slate">Loading...</p>}
          {!loading && cases.length === 0 && (
            <p className="text-sm text-slate">
              No cases ready for diagnosis yet.
            </p>
          )}
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/clinician/${c.id}`)}
              className="flex w-full items-center gap-4 rounded-md border border-line bg-white p-4 text-left shadow-sm hover:border-brand"
            >
              {c.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(c.images[0].storedName)}
                  alt=""
                  className="h-14 w-14 rounded-md object-cover"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-navy">
                  {c.patient?.pseudonymRef} · {c.organ}
                </p>
                <p className="text-xs text-slate">
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_STYLES[c.status] ?? "bg-line/60 text-slate",
                )}
              >
                {c.status.replace("_", " ")}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
